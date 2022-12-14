/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { assertType } from 'typelevel-assert';
import { CheckError, Is } from 'typescript-typelevel';
import { describe, it } from 'vitest'
import { ReflectContext, Check } from '../src/types';

describe('ReflectContext', () => {

    it('should reflect any', () => {
        type Actual = ReflectContext<any>;
        type Expected = unknown;
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect unknown', () => {
        type Actual = ReflectContext<unknown>;
        type Expected = unknown;
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect never', () => {
        type Actual = ReflectContext<never>;
        type Expected = never;
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect null', () => {
        type Actual = ReflectContext<null>;
        type Expected = unknown;
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect undefined', () => {
        type Actual = ReflectContext<undefined>;
        type Expected = unknown;
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect module with one factory and no context', () => {
        const module = {
            f: () => 1
        };
        type Actual = ReflectContext<typeof module>;
        type Expected = {};
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect module with one factory and a context = container', () => {
        const module = {
            f: (ctx: { f: number }) => 1
        };
        type Actual = ReflectContext<typeof module>;
        type Expected = {
            f: number
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect module with one factory and a context ??? container = ???', () => {
        const module = {
            f: (ctx: { g: number }) => 1
        };
        type Actual = ReflectContext<typeof module>;
        type Expected = {
            g: number
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should deep reflect module', () => {
        const module = {
            a: (ctx: { x: boolean }) => 1,
            b: {
                c: (ctx: {
                    y: {
                        yy: string
                    }
                }) => 1
            },
            c: {
                d: {
                    z: (ctx: {
                        z: number
                    }) => 1
                }
            }
        };
        type Actual = ReflectContext<typeof module>;
        type Expected = {
            x: boolean
            y: {
                yy: string
            }
            z: number
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should reflect module with a property that is never satisfied', () => {
        type M = {
            b: (ctx: { b: never }) => number
        };
        type Actual = ReflectContext<M>;
        type Expected = {
            b: never
        };
        assertType<Is<Actual, Expected>>();
    });

});

describe('Check', () => {

    it('should identify a context property  as missing', () => {
        type Actual = Check<[{
            f: (ctx: { b: 1 }) => 1
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency missing", ['b'], "https://docs.djinject.io/#dependency-missing">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should identify a plain property of type never as conflicting', () => {
        type Actual = Check<[{
            f: (ctx: { b: never }) => 1
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency conflict", ['b'], "https://docs.djinject.io/#dependency-conflict">,
                CheckError<"Dependency missing", ['b'], "https://docs.djinject.io/#dependency-missing">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should declare a deep property of type never as missing', () => {
        type Actual = Check<[{
            f: (ctx: {
                b: {
                    c: {
                        d: never
                    }
                }
            }) => 1
        },]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency conflict", ['b.c.d'], "https://docs.djinject.io/#dependency-conflict">,
                CheckError<"Dependency missing", ['b.c.d'], "https://docs.djinject.io/#dependency-missing">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should declare a deep property of type string as missing', () => {
        type Actual = Check<[{
            f: (ctx: {
                b: {
                    c: {
                        d: string
                    }
                }
            }) => 1
        },]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency missing", ['b.c.d'], "https://docs.djinject.io/#dependency-missing">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should declare two deep properties of type never as missing', () => {
        type Actual = Check<[{
            f: (ctx: {
                b: {
                    c: {
                        d: never
                    }
                    e: {
                        f: never
                    }
                }
            }) => 1
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency conflict", ['b.c.d', 'b.e.f'], "https://docs.djinject.io/#dependency-conflict">,
                CheckError<"Dependency missing", ['b.c.d', 'b.e.f'], "https://docs.djinject.io/#dependency-missing">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should identify a merged property of type never as missing', () => {
        // { b: boolean } and { b: string} = { b: never }
        type Actual = Check<[{
            f: (ctx: { b: boolean }) => 1
        }, {
            g: (ctx: { b: string }) => 1
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency conflict", ['b'], "https://docs.djinject.io/#dependency-conflict">,
                CheckError<"Dependency missing", ['b'], "https://docs.djinject.io/#dependency-missing">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should error if two factories require different types of the same dependency', () => {
        type Actual = Check<[{
            a: (ctx: { b: boolean }) => boolean
        }, {
            b: (ctx: { b: string }) => string
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency conflict", ['b'], "https://docs.djinject.io/#dependency-conflict">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should identify missing container property required by a context', () => {
        type Actual = Check<[{
            f: (ctx: { b: boolean }) => 1
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency missing", ['b'], "https://docs.djinject.io/#dependency-missing">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should remove a missing dependency by adding another module', () => {
        // no missing dependency because the new f does not need { b: boolean } anymore
        type Actual = Check<[{
            f: (ctx: { b: boolean }) => 1
        }, {
            f: () => 1
        }]>;
        type Expected = [{
            f: (ctx: { b: boolean; }) => 1
        }, {
            f: () => 1
        }];
        assertType<Is<Actual, Expected>>();
    });

    it('should not check factory return types', () => {
        // { f: () => number } and { f: () => string } = { f: () => never }
        type Actual = Check<[{
            f: () => 1
        }, {
            f: () => ''
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Type conflict", ["f"], "https://docs.djinject.io/#type-conflict">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should show multiple check errors', () => {
        type Actual = Check<[{
            f: (ctx: { b: boolean }) => 1
        }, {
            f: (ctx: { a: number, b: string }) => ''
        }]>;
        // especially, the different types of b are irrelevant
        // because the second module re-defines how b is used
        type Expected = {
            djinject_error: [
                CheckError<"Type conflict", ["f"], "https://docs.djinject.io/#type-conflict">, // because f returns different types
                CheckError<"Dependency missing", ["b", "a"], "https://docs.djinject.io/#dependency-missing"> // because f requires a and b
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should recognize dependency type conflict between 1) container and 2) context when using two modules', () => {
        type Actual = Check<[{
            a: () => number // 1) a is a number in the container
        }, {
            f: (ctx: { a: string }) => void // 2) a is a string in the context
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency conflict", ["a"], "https://docs.djinject.io/#dependency-conflict">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should recognize dependency type conflict between 1) context and 2) container when using two modules', () => {
        type Actual = Check<[{
            f: (ctx: { a: string }) => void // 1) a is a string in the context
        }, {
            a: () => number // 2) a is a number in the container
        }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Dependency conflict", ["a"], "https://docs.djinject.io/#dependency-conflict">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

    it('should check generic type parameters', () => {
        type Testee<T> = Check<[{ _: () => T }]>;
        type Actual= Testee<1>;
        type Expected = [{ _: () => 1 }];
        assertType<Is<Actual, Expected>>();
    });

    it('should check factory returning any', () => {
        type Actual= Check<[{ _: () => any }]>;
        type Expected = [{ _: () => any }];
        assertType<Is<Actual, Expected>>();
    });

    it('should check factory returning unknown', () => {
        type Actual= Check<[{ _: () => unknown }]>;
        type Expected = [{ _: () => unknown }];
        assertType<Is<Actual, Expected>>();
    });

    it('should check factory returning never', () => {
        type Actual= Check<[{ _: () => never }]>;
        type Expected = {
            djinject_error: [
                CheckError<"Type conflict", ["_"], "https://docs.djinject.io/#type-conflict">
            ]
        };
        assertType<Is<Actual, Expected>>();
    });

});
