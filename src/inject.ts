/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { keys, merge, Fn, MergeArray } from "./merge";

/**
 * Internally used by {@link eager} to tag an injector.
 * When {@link inject} is called, all eager injectors of the merged module arguments will be called.
 */
const isEager = Symbol();

/**
 * Internally used by {@link _resolve} to tag a requested dependency, directly before calling the factory.
 * This allows us to find cycles during instance creation.
 */
const requested = Symbol();

// ✅ a module that can be passed to the inject function
export type Module<C = any, T = C> = { // ensure C and T are real ojects { ... }
    [K in keyof T]: Module<C, T[K]> | Factory<C, T[K]> // it is up to the user to define the factories within the object hierarchy
};

// ✅ Internal
type InverseModule<T> = T extends Fn ? ReturnType<T> : {
    [K in keyof T]: InverseModule<T[K]>
};

// ✅ transforms a list of modules to an IoC container
export type Container<M extends Module[]> = InverseModule<MergeArray<M>>;

// ✅ a factory which receives the IoC container and returns a value/service (which may be a singleton value or a provider)
export type Factory<C, T> = (ctr: C) => T;

/**
 * Decorates an {@link Injector} for eager initialization with {@link inject}.
 *
 * @param factory
 */
export function eager<C, T>(factory: Factory<C, T>): Factory<C, T> {
    return (isEager in factory) ? factory : Object.assign((ctr: C) => factory(ctr), { [isEager]: true } );
}

/**
 * Given a set of modules, the inject function returns a lazily evaluted injector
 * that injects dependencies into the requested service when it is requested the
 * first time. Subsequent requests will return the same service.
 *
 * In the case of cyclic dependencies, an Error will be thrown. This can be fixed
 * by injecting a provider `() => T` instead of a `T`.
 *
 * Please note that the arguments may be objects or arrays. However, the result will
 * be an object. Using it with for..of will have no effect.
 *
 * @param module1 first Module
 * @param module2 (optional) second Module
 * @param module3 (optional) third Module
 * @param module4 (optional) fourth Module
 * @returns a new object of type I
 */
// ✅ inject takes modules (= dependency factories) and returns an IoC container (aka DI container) that is ready to use
// TODO(@@dd): verify that the container contains all dependencies that are needed
export function inject<M extends [Module, ...Module[]]>(...modules: M): Container<M> {
    const module = modules.reduce(merge, {});
    const container = proxify(module);
    initializeEagerServices(module, container);
    return container;
}

function initializeEagerServices<C, T, M extends Module<C, T>>(module: M, container: C): void {
    keys(module).forEach(key => {
        const value = module[key];
        if (typeof value === 'function') {
            (isEager in value) && value(container);
        } else {
            initializeEagerServices(value, container);
        }
    });
}

function proxify<C, T>(module: Module<C, T>, container?: C, path?: string): T {
    const proxy: any = new Proxy({}, {
        deleteProperty: () => false,
        get: (target, prop) => resolve(target, prop, module, container || proxy, path),
        getOwnPropertyDescriptor: (target, prop) => (resolve(target, prop, module, container || proxy, path), Object.getOwnPropertyDescriptor(target, prop)), // used by for..in
        has: (_, prop) => prop in module, // used by ..in..
        ownKeys: () => Reflect.ownKeys(module)
    });
    return proxy;
}

/**
 * Returns the value `obj[prop]`. If the value does not exist, yet, it is resolved from
 * the module description. The result of service factories is cached. Groups are
 * recursively proxied.
 *
 * @param obj an object holding all group proxies and services
 * @param prop the key of a value within obj
 * @param module an object containing groups and service factories
 * @param container the first level proxy that provides access to all values
 * @returns the requested value `obj[prop]`
 * @throws Error if a dependency cycle is detected
 */
function resolve<T>(obj: any, prop: PropertyKey, module: any, container: any, parentPath?: string): T[keyof T] | undefined {
    const path = (parentPath ? '.' : '') + String(prop);
    if (prop in obj) {
        // TODO(@@dd): create an error that isn't instanceof Error (which could be a valid service)
        if (obj[prop] instanceof Error) {
            throw new Error('Construction failure: ' + path);
        }
        if (obj[prop] === requested) {
            // TODO(@@dd): refer to the GitHub readme of ginject instead of langium docs
            throw new Error('Cycle detected. Please make ' + path + ' lazy. See https://github.com/langium/ginject#cyclic-dependencies');
        }
        return obj[prop];
    } else if (prop in module) {
        const value = module[prop];
        obj[prop] = requested;
        try {
            obj[prop] = (typeof value === 'function') ? value(container) : proxify(value, container, (path ? '.' : ''));
        } catch (error) {
            // TODO(@@dd): create an error that isn't instanceof Error (which could be a valid service)
            obj[prop] = error instanceof Error ? error : undefined;
            throw error;
        }
        return obj[prop];
    } else {
        return undefined;
    }
}
