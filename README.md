# Fate.js

**Fate** is a framework that provides promise-based asynchronous tools including multivalent deferrals, pipelines, multiplexes, and procedures.

* [**Deferral**](#deferral) — Multivalent deferred object
	* [Background](#deferral--background)
	* [Overview](#deferral--overview)
		* [Responding to a deferral’s resolution](#deferral--overview--responding-to-a-deferrals-resolution)
		* [Constructor syntax](#deferral--overview--constructor-syntax)
	* [Features](#deferral--features)
		* [Early binding](#deferral--features--early-binding)
		* [Arity](#deferral--features--arity)
		* [Formal subtypes](#deferral--features--formal-subtypes):
			[Binary](#deferral--features--formal-subtypes--binary),
			[Unary](#deferral--features--formal-subtypes--unary),
			[Nullary](#deferral--features--formal-subtypes--nullary)
	* [Remarks](#deferral--remarks)
		* [Terminology](#deferral--remarks--terminology)
			* [“Deferral”](#deferral--remarks--terminology--deferral)
			* [“Future”, et al](#deferral--remarks--terminology--future)
			* [“Resolved”](#deferral--remarks--terminology--resolved)
	* [Methods](#deferral--methods)
		* [Interfacing](#deferral--methods--interfacing):
			[`promise`](#deferral--methods--interfacing--promise)
		* [Querying](#deferral--methods--querying):
			[`potential`](#deferral--methods--querying--potential),
			[`futures`](#deferral--methods--querying--futures),
			[`did`](#deferral--methods--querying--did),
			[`resolution`](#deferral--methods--querying--resolution)
		* [Registration](#deferral--methods--registration):
			[{ `yes`, `no` } | `resolved`](#deferral--methods--registration--registrar),
			[`then`](#deferral--methods--registration--then),
			[`always`](#deferral--methods--registration--always)
			[`empty`](#deferral--methods--registration--empty)
		* [Resolution](#deferral--methods--resolution):
			[`as`](#deferral--methods--resolution--as),
			[`given`](#deferral--methods--resolution--given),
			[{ `affirm`, `negate` } | `resolve`](#deferral--methods--resolution--resolver),
		* [Sequencing](#deferral--methods--sequencing):
			[`pipe`](#deferral--methods--sequencing--pipe)
		* [Concurrency](#deferral--methods--concurrency):
			[`when`](#deferral--methods--concurrency--when)
* [**Promise**](#promise) — The public interface to a deferral
	* [Methods](#promise--methods)
		* [Constructor](#promise--methods--constructor):
			[`resembles`](#promise--methods--constructor--resembles)
		* [Inherited](#promise--methods--inherited)
		* [Introspection](#promise--methods--introspection):
			[`serves`](#promise--methods--serves)
* [**Pipeline**](#pipeline) — Deferrals arranged serially in continuation-passing style
	* [Remarks](#pipeline--remarks)
		* [Considerations of using synchronous versus asynchronous continuations](#pipeline--remarks--sync-vs-async)
		* [Comparison to Deferral().pipe()](#pipeline--remarks--comparison-to-pipe)
	* [Methods](#pipeline--methods)
		* [Array methods](#pipeline--methods--array-methods): `push`, `pop`, `shift`, `unshift`, `reverse`, `splice`, `length`
		* [Interfacing](#pipeline--methods--interfacing):
			[`promise`](#pipeline--methods--interfacing--promise)
		* [Querying state](#pipeline--methods--querying-state):
			[`operation`](#pipeline--methods--querying-state--operation),
			[`args`](#pipeline--methods--querying-state--args),
			[`isRunning`](#pipeline--methods--querying-state--isRunning)
		* [Control](#pipeline--methods--control):
			[`start`](#pipeline--methods--control--start),
			[`pause`](#pipeline--methods--control--pause),
			[`resume`](#pipeline--methods--control--resume),
			[`stop`](#pipeline--methods--control--stop)
	* [Examples](#pipeline--examples)
* [**Multiplex**](#multiplex) — Multiple pipelines operating in parallel over the same array of deferrals
	* [Remarks](#multiplex--remarks)
		* [Comparison to Deferral.when()](#multiplex--remarks--comparison-to-when)
	* [Methods](#multiplex--methods)
		* [Array methods](#multiplex--methods--array-methods): `push`, `pop`, `shift`, `unshift`, `reverse`, `splice`, `length`
		* [Interfacing](#multiplex--methods--interfacing):
			[`promise`](#multiplex--methods--interfacing--promise)
		* [Querying state](#multiplex--methods--querying-state):
			[`isRunning`](#multiplex--methods--querying-state--isRunning),
			[`width`](#multiplex--methods--querying-state--width)
		* [Control](#multiplex--methods--control):
			[`start`](#multiplex--methods--control--start),
			[`stop`](#multiplex--methods--control--stop)
* [**Procedure**](#procedure) — Arbitrarily complex arrangements of serial and parallel operations, in a concise literal syntax
	* [Methods](#procedure--methods):
		[`promise`](#procedure--methods----promise),
		[`start`](#procedure--methods----start)
	* [Examples](#procedure--examples)


<a name="deferral" />
# Deferral

A **deferral** is a small state machine that encapsulates a response to the outcome of some future event. It is a fundamental unit of many types of asynchronous constructs, including flow-control devices [**pipeline**](#pipeline), which processes deferred operations as a sequence of continuations, [**multiplex**](#multiplex), which processes an array of operations in parallel by bundling multiple concurrent pipelines together, and interpreted [**procedures**](#procedure), which employ an array- and object-literal based syntax, as well as some familiar control structures, to process arbitrarily complex arrangements of asynchronous operations.


<a name="deferral--background" />
## Background

`Deferral` is an extension of the *promise pattern*, which commonly describes a **future** in terms of a binary proposition that will finally resolve to either a `success` state or a `failure` state. `Deferral` is essentially a multivalent version of this, providing the ability to define arbitrary resolution states, to any number and depth.


<a name="deferral--overview" />
## Overview

A deferral describes the interval between the “present” and one of several possible “futures”, which are presented as **states** of the deferral, arranged in a tree structure. Starting in the present, the deferral is considered to be in its **unresolved state**, and sometime later, the deferral will be transitioned into its general **resolved state**, and specifically, one of that state’s substates, which becomes that deferral’s final **resolution state**. The deferral will then invoke all callbacks that have been registered to any state from the top-level resolved state down to the specific substate that is its resolution state.

<a name="deferral--overview--responding-to-a-deferrals-resolution" />
### Responding to a deferral’s resolution

Each resolved substate is directly associated with an eponymous **registrar method** and **callback queue**. Consumers of the deferral may at any time use a registrar method to add callbacks to the associated queue. While in the unresolved state, these callbacks are simply saved to the queue, potentially to be executed later pending the deferral’s resolution; Once the corresponding **resolver method** of a particular queue is called, the deferral transitions to the resolver’s associated resolved substate, the callbacks in its queue are executed, and all other queues are emptied. Thereafter, if new callbacks are added to the queue of the selected substate, they will be executed immediately, while callbacks subsequently added to any of the other queues will be ignored.

<a name="deferral--overview--constructor-syntax" />
### Constructor syntax

Instantiating a deferral takes the form

```javascript
var Deferral = Fate.Deferral;
	
[new] Deferral( [ { <state>: <resolver>, ... } ], [ /*Function*/ function, [ /*Array*/ arguments ] ] )
```

The first argument is an optional hashmap that describes the deferral’s **resolution potential** by relating the names of each resolved substate to the name of its associated resolver method (examples follow, under the section [“Arity”](#deferral--features--arity)). The second and third arguments specify an optional function and arguments that will be called immediately in the context of the new deferral once it has been constructed.


<a name="deferral--features" />
## Features

<a name="deferral--features--early-binding" />
### Early binding

When a deferral is resolved it is commonly desirable to specify a context and set of arguments that will be applied to the callbacks. An unresolved `Deferral` provides the chainable method `as()` that will set the resolution context to be used when the deferral is later resolved. The arguments may be set in this manner as well with the method `given()`, which takes an array. These allow parts of the deferral’s future resolution state to be set early, if they are known, and the deferral to be resolved agnostically later.

For example:

```javascript
Deferral().as( context ).affirm( arg1, arg2, ... );
```

which is equivalent to

```javascript
Deferral().as( context ).given([ arg1, arg2, ... ]).affirm();
```

both of which might compare with

```javascript
jQuery.Deferred().resolveWith( context, arg1, arg2, ... );
```

<a name="deferral--features--arity" />
### Arity

`Deferral` is variadic, in that any number of possible futures may be defined as resolution states. An instantiation of `Deferral` may include a specification of its resolution potential, a one-to-one mapping of callback queues to resolver methods. A typical pattern is a _binary_ deferral that names two queues, such as `yes` and `no`, which map to resolver methods that could be named `affirm` and `negate`; this could be constructed like so:

```javascript
Deferral({ yes: 'affirm', no: 'negate' });
```

This can be extended further if more outcomes are to be accounted for:

```javascript
Deferral({ yes: 'affirm', no: 'negate', maybe: 'punt', confused: 'waffle', distracted: 'squirrel' });
```

Alternatively, supposing we wish to mimic the syntax of the jQuery Deferred object, we’re also free to create:

```javascript
Deferral({ done: 'resolve', fail: 'reject' });
```

<a name="deferral--features--formal-subtypes" />
### Formal subtypes

Most applicable use cases for `Deferral` are served by its built-in subtypes. As introduced above, the most common usage is the `BinaryDeferral` at `Deferral.Binary` that names two callback queues, `yes` and `no`, invoked by calling `affirm()` or `negate()`, respectively. The default implementation of `Deferral` returns this binary subtype.

```javascript
var deferral = Deferral(); // BinaryDeferral
deferral.yes( fn1 ).no( fn2 ); // === d.then( fn1, fn2 )
deferral.as( context ).given( args ).affirm(); // === fn1.apply( context, args )
```

For applications in which there exists only one possible outcome, there is the `UnaryDeferral` at `Deferral.Unary`, which contains a single callback queue, `done`, invoked by calling `resolve()`.

```javascript
var deferral = Deferral.Unary(); // UnaryDeferral
deferral.done( fn1, fn2 ); // === d.always( fn1, fn2 )
deferral.as( context ).resolve( arg ); // === ( fn1.call( context, arg ), fn2.call( context, arg ), d )
```

Sometimes it may also be desirable to incorporate synchronous logic into an asynchronous environment — a situation that involves, in a sense, _zero_ possible futures. For this special case there is the `NullaryDeferral` at `Deferral.Nullary`, essentially a “pre-resolved” deferral, wherein all callbacks added are simply executed immediately. A nullary deferral has no resolution potential, and thus no callback queues and no registrar or resolver methods, but it does provide conformance to the fundamental promise interface via `then()` and `promise()`. In addition, `empty()` is obviated, and methods `as()` and `given()` are defunct, with context and arguments for callbacks instead provided as arguments of the `NullaryDeferral` constructor:

```javascript
var deferral = Deferral.Nullary( asContext, givenArguments ); // NullaryDeferral
deferral.then( fn ); // === ( fn1.apply( asContext, givenArguments ), deferral.promise() )
```


<a name="deferral--remarks" />
## Remarks

<a name="deferral--remarks--terminology" />
### Terminology

<a name="deferral--remarks--terminology--deferral" />
#### “Deferral”

Whereas other frameworks follow the legacy of Twisted by adopting the term “Deferred” as a nominalized contraction of “deferred object”, the design choice in **Fate** is to name the analogous type using the grammatically appropriate noun, “Deferral”. However, apart from nomenclature and implementation, the core concept that underlies `Deferral` and the various incarnations of `Deferred` is largely the same.

<a name="deferral--remarks--terminology--future" />
#### “Future”, et al

In the context of `Deferral`, the concepts of a “future” and “resolved substate” are essentially identical. Moreover, each future (or resolved substate) necessarily shares its explicit name with the entities “callback queue” and “registrar method” associated with it; thus as a matter of usage, a named reference to any of these entities can be thought to implicate the others.

<a name="deferral--remarks--terminology--resolved" />
#### “Resolved”

In particular, those familiar with the jQuery and Dojo `Deferred` implementations may note a difference in usage regarding the notion of “resolved”. Whereas to `resolve()` a `Deferred` instance explicitly indicates a “successful” outcome, **Fate** considers _resolved_ to denote only the opposite of _unresolved_, i.e., that a deferral has transitioned into its final resolution state, without implication as to success or failure or any concept of precisely which state that is. In the case of the default type `BinaryDeferral`, which compares most directly to a canonical `Deferred`, rather than being either `resolve`d or `reject`ed, it may be either `affirm`ed or `negate`d, as alluded to above. (Note however that the `UnaryDeferral` type _does_ in fact use `resolve` as its resolver method, which stands to reason given that it has only one resolved substate.)


<a name="deferral--methods" />
## Methods

<a name="deferral--methods--interfacing" />
### Interfacing

<a name="deferral--methods--interfacing--promise" />
#### promise()

Returns a `Promise`, a limited interface into the deferral that allows callback registration and resolution state querying, but disallows any means of affecting the deferral’s resolution state.


<a name="deferral--methods--querying" />
### Querying

<a name="deferral--methods--querying--potential" />
#### potential()

Returns a hashmap relating the names of the deferral’s resolution states (and likewise its callback queues and registrar methods) to the names of their corresponding resolver methods.

```javascript
JSON.stringify( Deferral().potential() ); // {"yes":"affirm","no":"negate"}
```

<a name="deferral--methods--querying--futures" />
#### futures()

Returns an Array that is an ordered list of the names of the deferral’s resolution states (and likewise its callback queues and registrar methods).

```javascript
Deferral().futures(); // ["yes", "no"]
```

<a name="deferral--methods--querying--did" />
#### did( [`String` resolver] )

If no argument is provided, `did()` indicates simply whether the deferral has been resolved; or, given a specified `resolver` method name, `did( resolver )` returns `true` if the deferral was resolved using `resolver`, and `false` otherwise. 

```javascript
Deferral().did(); // false
Deferral().affirm().did('affirm'); // true
Deferral().negate().did('affirm'); // false
Deferral().negate().did(); // true
Deferral.Nullary().did(); // true
```

<a name="deferral--methods--querying--resolution" />
#### resolution( [`String` test] )

If no arguments are provided, `resolution()` returns the name of the state to which the deferral has resolved, or returns `undefined` if the deferral is still unresolved. For a nullary deferral, `resolution()` always returns `true`.

```javascript
Deferral().resolution(); // undefined
Deferral().affirm().resolution(); // "yes"
Deferral.Unary().resolve().resolution(); // "done"
Deferral.Nullary().resolution(); // true
```

If a `String` is provided as an argument, `resolution( test )` returns `true` if the deferral’s `resolution()` matches `test`, returns `false` if the deferral was otherwise resolved, or returns `undefined` if it is still unresolved.

```javascript
Deferral().resolution('no'); // undefined
Deferral().negate().resolution('yes'); // false
```

<a name="deferral--methods--registration" />
### Registration

Methods listed here return the deferral itself. (Note however that, when invoked from a `Promise` to this deferral, these methods return the promise, not the deferral.)

<a name="deferral--methods--registration--registrar" />
#### (_registrar_)( `Function` callback | `Array` callbacks, ... )

Administers the supplied callback functions according to the deferral’s resolution state:

* In the unresolved state, the callbacks are registered to the corresponding queue, and will be called if the deferral is later resolved accordingly.

* If the deferral has already been resolved accordingly, the callbacks are called immediately.

* If the deferral has been otherwise resolved, the callbacks are discarded.

Values for built-in `Deferral` subtypes:
	
* `UnaryDeferral` : _registrar_ = { `done` }

* `BinaryDeferral` : _registrar_ = { `yes` | `no` }

Examples:

```javascript
Deferral()
    .yes( function () { console.log("hooray!"); } )
    .no( function () { console.log("boooo!"); } )
    .affirm()                                                // log <<< "hooray!"
    .yes( function () { console.log("Sorry I'm late!"); } )  // log <<< "Sorry I'm late!"
    .no( function () { console.log("I said BOOOO!"); } );    // (no output)

setTimeout( Deferral.Unary().done( function () { console.log("At last!"); }).resolve, 1000 );
// (one second later)                                           log <<< "At last!"
```

<a name="deferral--methods--registration--then" />
#### then( `Function` callback | `Array` callbacks, ... )

Registers callbacks as above to each callback queue in order, such that the indices of the local `arguments` correspond with the array returned by `futures()`.

<a name="deferral--methods--registration--always" />
#### always( `Function` callback | `Array` callbacks, ... )

Registers callbacks to all queues, ensuring they will be called no matter how the deferral is resolved.

<a name="deferral--methods--registration--empty" />
#### empty()

Clears all callback queues. (Not available from a `Promise`.)


<a name="deferral--methods--resolution" />
### Resolution

Methods listed here return the deferral itself.

<a name="deferral--methods--resolution--as" />
#### as( `Object` context )

Sets the context in which all executed callbacks will be called after the deferral is resolved. Context may be overwritten any number of times prior to the deferral’s resolution; if not specified, the context defaults to the deferral itself. After resolution, the context is frozen; subsequent calls to `as` have no effect.

<a name="deferral--methods--resolution--given" />
#### given( `Array` args )

Preloads resolution arguments in an unresolved deferral. Like `as()` for context, resolution arguments may be overwritten with `given` any number of times prior to the deferral’s resolution, but after resolution the arguments are frozen, and subsequent calls to `given` have no effect. Will be overridden if arguments are included with a call to one of the _resolver_ methods.

<a name="deferral--methods--resolution--resolver" />
#### (_resolver_)( ...arguments )

Resolves the deferral to the associated resolution substate, executing all registered callbacks for the corresponding queue, now and in the future, in the context specified previously via `as()`, with arguments supplied here as `...arguments` if included, or those specified previously via `given()`.

Values for built-in `Deferral` subtypes:
	
* `UnaryDeferral` : _resolver_ = { `resolve` }
		
* `BinaryDeferral` : _resolver_ = { `affirm` | `negate` }


<a name="deferral--methods--sequencing" />
### Sequencing

<a name="deferral--methods--sequencing--pipe" />
#### pipe( `Function` callback | `Array` callbacks, ... )

Registers callbacks to a separate new deferral, whose resolver methods are registered to the queues of this deferral (`this`), and returns a promise bound to the succeeding deferral. This arrangement forms an ad-hoc **pipeline**, which can be extended indefinitely with chained calls to `pipe`. (Note the distinction between this ad-hoc pipeline and the formal `Pipeline` type described below.) Once resolved, the original deferral (`this`) passes its resolution state, context, and arguments on to the succeeding deferral, whose callbacks may then likewise dictate the resolution parameters of its succeeding `pipe`d deferral, and so on.

Synchronous callbacks that return immediately will cause the succeeding deferral to resolve immediately, with the same resolution state and context from its receiving deferral, and the callback’s return value as its lone resolution argument. Asynchronous callbacks that return their own promise or deferral will cause the succeeding deferral to resolve similarly once the callback’s own deferral is resolved.


<a name="deferral--methods--concurrency" />
### Concurrency

<a name="deferral--methods--concurrency--when" />
#### when()

Facilitates parallel execution by binding together the fate of multiple promises. The promises represented by each supplied argument are overseen by a master binary deferral, such that the master deferral will be `affirm`ed only once each individual promise has itself resolved to the expected resolution, or will be `negate`d if any promise is otherwise resolved.

Returns a promise to this master deferral.

If `when` is called as a method of an unresolved binary deferral, then that deferral is used as the master deferral; otherwise, a new binary deferral is created for this purpose. The method is also available as a static member of the `Deferral` constuctor.

By default, `when` monitors the promises for their implicitly affirmative resolution state, i.e., the state targeted by the first argument of `then()`. A specific resolution state can be supplied as a `String` at the last argument position in the `when()` call. For example, the promise returned by:

```javascript
var bizzaro = Deferral.when( promiseA, promiseB, 'no' );
```

will `affirm` to the `yes` resolution if `promiseA` and `promiseB` are both eventually `negate`d to their respective `no` resolution states.



<a name="promise" />
# Promise

	deferral.promise()

At any time a deferral can issue a partial interface to itself in the form of a **promise**, which contains a subset of the deferral’s methods. Consumers of the promise can use it to make additions to the associated deferral’s callback queues, and to query its resolution state, but cannot use it to directly alter the state by resolving the deferral. For example, the promise issued by the default `Deferral` will include `yes` and `no` registrar methods for adding callbacks, but will not include the `affirm` or `negate` resolver methods that would alter the deferral’s resolution state.

Because a deferral is in a sense an extension of its associated promise, in most cases it is possible for a `Deferral` to be substituted wherever `Promise` is called for.

As a matter of usage, while it is possible to acquire a promise given an available deferral reference by instantiating `new Fate.Promise( deferral )`, the preferred approach is to call `deferral.promise()`, which can retrieve a promise generated from previous invocations instead of unnecessarily instantiating a new one.

<a name="promise--methods" />
## Methods

<a name="promise--methods--constructor" />
### Constructor

<a name="promise--methods--constructor--resembles" />
#### Promise.resembles( obj )

Returns a boolean indicating whether `obj` is a `Promise` or `Deferral`, or if it at least exposes methods `then` and `promise`; this duck-typing allows foreign promise-like objects to participate in most of the promise based functionality.

<a name="promise--methods--inherited" />
### Inherited

Each method listed here wraps the corresponding method in the deferral associated with this promise.

#### promise
#### potential
#### futures
#### did
#### resolution
#### then
#### always
#### pipe

<a name="promise--methods--introspection" />
### Introspection

<a name="promise--methods--introspection--serves" />
#### serves( `Deferral` deferral )

Returns a boolean indicating whether `this` promise belongs to `deferral`.



<a name="pipeline" />
# Pipeline

```javascript
var Pipeline = Fate.Pipeline;

[new] Pipeline( /*Array*/ operations )
```

Deferrals facilitate the use of **continuations** to create a special type of operation `Pipeline`, which executes a sequence of synchronous or asynchronous functions in order, passing a set of arguments from one to the next as each operation completes.

Synchronous functions must return the array of arguments to be relayed on to the next operation. Asynchronous functions must return a `Promise` to a `Deferral` that will be resolved at some point in the future, whereupon its resolution arguments are relayed on to the next operation.

```javascript
function fn1 ( a, b ) { return [ a + 1, b + 1 ]; }
function fn2 ( a, b ) {
	var d = Deferral();
	setTimeout( function () { d.affirm( a + 2, b + 2 ); }, 1000 );
	return d.promise();
}
function fn3 ( a, b ) { return [ a + 3, b + 3 ]; }

var pipeline = new Pipeline( [ fn1, fn2, fn3 ] );

pipeline.start( 0, 1 )
	.promise()
	.then( function ( a, b ) {
		assert.ok( a === 6 && b === 7 ); // true
	});
```

The array passed as an argument will be treated as mutable; each element is `shift`ed out of the array as it is executed. If the array’s integrity must be preserved, it should be copied before the constructor is called:

```javascript
var array = [ fn1, fn2, fn3 ],
    pipeline = Pipeline( array.slice() );
```


<a name="pipeline--remarks" />
## Remarks

<a name="pipeline--remarks--sync-vs-async" />
### Considerations of using synchronous versus asynchronous continuations

A sequence of short synchronous operations can be processed more quickly since its operations continue immediately. However, because immediate continuations accumulate on the stack, and JavaScript does not employ tail-call optimization, these sequences incur a memory overhead that may become problematic as more synchronous operations are strung together. In addition, because contiguous synchronous operations are processed within a single _frame_, or turn of the event loop, too long a sequence could have a significant impact on the _frame rate_, which on the client may include noticeable interruptions to user experience.

Asynchronous operations advance through the pipeline no faster than one operation per frame, but this has the advantages of not polluting the stack and of long sequences not prolonging the duration of the frame in which it’s executing.

Synchronous and asynchronous operations can be mixed together arbitrarily to provide granular control over this balance of immediacy versus frame imposition.

<a name="pipeline--remarks--comparison-to-pipe" />
### Comparison to Deferral().pipe()

`Pipeline` and `pipe()` are conceptually similar, in that both arrange a succession of deferrals using continuation-style passing to relay a set of arguments from one deferral to the next. With `pipe()`, this can be arranged on the fly given any promise or deferral; however, `Pipeline` consumes stack space more efficiently when processing synchronous functions.

<a name="pipeline--methods" />
## Methods

<a name="pipeline--methods--array-methods" />
### Array methods

Each method in this section mirrors that of `Array`, acting upon the internal array of operation functions contained within the pipeline; `length` is an exception in that it is a method rather than a property.

#### push
#### pop
#### shift
#### unshift
#### reverse
#### splice
#### length

<a name="pipeline--methods--interfacing" />
### Interfacing

<a name="pipeline--methods--interfacing--promise" />
#### promise

Returns a promise to the internal binary deferral, which will be `affirm`ed after each item in the pipeline has itself been affirmatively resolved, or `negate`d if any item is non-affirmatively resolved.

<a name="pipeline--methods--querying-state" />
### Querying state

<a name="pipeline--methods--querying-state--operation" />
#### operation

Returns the currently running or most recently completed operation.

<a name="pipeline--methods--querying-state--args" />
#### args

Returns the arguments passed to the most recent operation function.

<a name="pipeline--methods--querying-state--isRunning" />
#### isRunning

Returns a boolean indicating whether an operation is currently underway.

<a name="pipeline--methods--control" />
### Control

Methods in this section return the `Pipeline` itself.

<a name="pipeline--methods--control--start" />
#### start( ...arguments )

Starts execution of operations through the pipeline, passing any supplied arguments to the first operation function.

<a name="pipeline--methods--control--pause" />
#### pause

Commands the pipeline to pause execution after the currently executing operation completes.

<a name="pipeline--methods--control--resume" />
#### resume

Resumes execution, or cancels a pending `pause` command.

<a name="pipeline--methods--control--stop" />
#### stop

Stops execution and resolves the pipeline’s deferral.


<a name="pipeline--methods--examples" />
## Examples

* [This unit test](https://github.com/zvector/fate/blob/master/test/unit/Pipeline.test.js) provides a step-by-step demonstration of a `Pipeline` at work. It mixes together both synchronous and asynchronous operations, and illustrates some of the tail-call considerations mentioned above.



<a name="multiplex" />
# Multiplex

```javascript
var Multiplex = Fate.Multiplex;

[new] Multiplex( /*Number*/ width, /*Array*/ operations )
```

A **multiplex** employs a specific number of concurrent pipelines to process an array of operations in parallel. Its `width`, which is the maximum number of pipelines that are allowed to operate concurrently, can be adjusted dynamically as the multiplex is running; this will cause pipelines to be automatically added as necessary, or removed as necessary once their current operations complete.

As with `Pipeline`, the `operations` array is considered mutable. All of the constituent pipelines reference this shared array, which will be `shift`ed by each pipeline as it proceeds to consume an operation.


<a name="multiplex--remarks" />
## Remarks

<a name="multiplex--remarks--comparison-to-when" />
### Comparison to Deferral.when()

It is worth nothing that the mechanism of `when` is essentially an infinite-width multiplex applied to a static array of operations. It is a simpler construct, however, and can be expected to be as performant or better compared to an equivalent `Multiplex`. Therefore, if it is certain that the operations array need not be dynamic, and that concurrency limits are unnecessary, then `when` should be considered preferable to `Multiplex`.


<a name="multiplex--methods" />
## Methods

<a name="multiplex--methods--array-methods" />
### Array methods

Each method in this section mirrors that of `Array`, acting upon the internal array of operation functions; `length` is an exception in that it is a method rather than a property.

#### push
#### pop
#### shift
#### unshift
#### reverse
#### splice
#### length

<a name="multiplex--methods--interfacing" />
### Interfacing

<a name="multiplex--methods--interfacing--promise" />
#### promise

Returns a promise to the internal deferral that will be resolved once all of the constituent pipelines have been resolved.

<a name="multiplex--methods--querying-state" />
### Querying state

<a name="multiplex--methods--querying-state--isRunning" />
#### isRunning

Returns a boolean indicating whether any pipelines are currently running.

<a name="multiplex--methods--querying-state--width" />
#### width( [ `Number` n ] )

If no arguments are provided, `width()` gets and returns the upper limit on the number of concurrent pipelines.

If a numeric value is provided as an argument, `width( n )` sets and returns a new upper limit `n` on the number of concurrent pipelines. Widening a running multiplex will automatically start additional pipelines as necessary, which will begin processing the next available operations. Narrowing the multiplex may not take effect immediately; the necessary number of pipelines will be terminated only once each has completed its current operation.

<a name="multiplex--methods--control" />
### Control

<a name="multiplex--methods--control--start" />
#### start

Creates and starts the necessary number of pipelines, limited to `width`, given the supplied `arguments`.

<a name="multiplex--methods--control--stop" />
#### stop

Stops execution and resolves the multiplex’s deferral.



<a name="procedure" />
# Procedure

```javascript
var Procedure = Fate.Procedure;

[new] Procedure( [ ... ] | [[ ... ]] | {n:[ ... ]} )
```

A **procedure** conveniently employs `Pipeline`, `when`, and `Multiplex`, using symbolic JSON literals, to describe a concerted progression of serial, parallel, and fixed-width–parallel execution flows. It is constructed by grouping multiple functions into nested array structures of arbitrary depth, where:

* A normal array literal `[ ]` represents a group of functions to be executed in a serial queue, using a `Pipeline`.

* A **double array literal** `[[ ]]` represents a group of functions to be executed as a parallel set, using a `when` invocation.

* A **numerically-keyed object–bound array literal** `{n:[ ]}` represents a group of functions to be executed in parallel, up to `n` items concurrently, using a `Multiplex` of width `n`.


<a name="procedure--methods" />
## Methods

<a name="procedure--methods----promise" />
#### promise

Returns a promise to the internal deferral that will be resolved once the procedure is completed.

<a name="procedure--methods----start" />
#### start

Initiates the procedure. (Does not currently define behavior for arguments.)


<a name="procedure--examples" />
## Examples

In the following example, a procedure is constructed from both parallel and serial sets of asynchronous functions that return promises. Each function must execute in the order indicated by its specific `n` value for the procedure to complete successfully. Note in particular the timing sequence going from `fn(3)` to `fn(6)`, illustrating the consequences of nesting parallel and serial sets inside one another.

```javascript
var Deferral = Fate.Deferral,
    Procedure = Fate.Procedure,
    number = 0;

function fn ( n ) {
	return function () {
		var deferral = new Deferral;
		setTimeout( function () {
			n === ++number ? deferral.affirm() : deferral.negate( n );
		}, 100 );
		return deferral.promise();
	};
}

Procedure([
	fn(1),
	[[
		fn(2),
		[ fn(3), fn(6) ],
		[[ fn(4), fn(5) ]]
	]],
	[ fn(7), fn(8) ]
])
	.start()
	.then( function () {
		window.console && console.log( number ); // 8
	});
```

The next example further illustrates this principle using a significantly more complex graph. Again, each function must execute in the proper order for the procedure to complete successfully (this time with a final `number` value of `22`). Even amidst the apparent tangle, the logic of the execution order indicated is discernable, keeping in mind that: (a) the function elements of a series (`[ ]`) must await the completion of their preceeding element; (b) elements of a parallel set (`[[ ]]`) are invoked as soon as possible; and (c) elements of a multiplexed set (`{n:[ ]}`) are invoked as soon as possible but no sooner than `n` elements at a time.

```javascript
var Deferral = Fate.Deferral,
    Procedure = Fate.Procedure,
    number = 0;

function fn ( n ) {
	return function () {
		var deferral = new Deferral;
		setTimeout( function () {
			n === ++number ? deferral.affirm() : deferral.negate( n );
		}, 100 );
		return deferral.promise();
	};
}

Procedure([
	fn(1),
	[[
		fn(2),
		{ 2:[
			fn(3),
			fn(4),
			[
				fn(6),
				[[
					fn(9),
					fn(10),
					[[ fn(11), fn(12) ]]
				]],
				fn(15),
				[
					fn(17),
					fn(19)
				]
			],
			fn(7),
			[[
				fn(13),
				[ fn(14), fn(16) ]
			]],
			fn(18)
		]},
		[ fn(5), fn(8) ]
	]],
	[ fn(20), fn(21) ],
	fn(22)
])
	.start()
	.then( function () {
		window.console && console.log( number );  // log <<< 22
	});
```


## Future directions

_Comment about flowing arguments through the procedure via `start()`, similar to `Pipeline`_

_Should `when` be built further to save return values of its elements and apply a reduce function over them?_