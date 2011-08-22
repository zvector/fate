* **Deferral** — stateful callback management for groups of asynchronous operations
	* Background
	* Overview
	* Features
		* Early binding
		* Arity
		* Subtypes: binary, unary, nullary
	* Remarks
		* Terminology
	* Methods
		* Interfacing: `promise`
		* Querying: `map`, `queueNames`, `did`, `resolution`
		* Registration: { `yes`, `no` } | `resolved`, `then`, `always`
		* Sequencing: `pipe`
		* Concurrency: `when`
		* Resolution: `as`, `given`, { `affirm`, `negate` } | `resolve`, `empty`
* **Promise** — the public interface to a deferral
* **Pipeline** — deferrals arranged sequentially in continuation-passing style
	* Remarks
		* Considerations of using synchronous versus asynchronous continuations
		* Comparison to Deferral().pipe()
	* Methods
		* Array methods: `push`, `pop`, `shift`, `unshift`, `reverse`, `splice`, `length`
		* Interfacing: `promise`
		* Querying state: `operation`, `args`, `isRunning`
		* Control: `start`, `pause`, `resume`, `stop`
	* Examples
* **Multiplex** — multiple pipelines operating in parallel over the same array of deferrals
	* Remarks
		* Comparison to Deferral.when()
	* Methods: `promise`, `width`, `start`, `stop`
* **Procedure** — parallel and serial operations together in concise literal syntax
	* Methods: `promise`, `start`
	* Examples


# Deferral

A **deferral** is a stateful callback device used to manage the eventualities of asynchronous operations.

## Background

`Deferral` is an extension of the _promise_ pattern. Implementations of this pattern have gained wide usage and refinement in JavaScript recently: in early 2011 **jQuery** with version 1.5 added its own [Deferred](http://api.jquery.com/category/deferred-object/) object that it both exposes and uses internally to power features such as `$.ajax`; this in turn was based largely on a similar [Deferred](http://dojotoolkit.org/api/1.6/dojo/Deferred) implementation in **Dojo** whose earliest form dates back to before the original 1.0 release, and itself inherits from earlier implementations in **MochiKit** and the **Twisted** framework in Python.

## Overview

A deferral collects potential execution paths, in the form of callbacks, that may be performed later pending the deferral's resolution to a particular outcome. Which path is taken is characterized by the deferral's **resolution state**. Initially, the deferral is said to be in an _unresolved_ state; at some point in the future, it will irreversibly transition into one of its _resolved substates_. 

Each resolved substate is directly associated with an eponymous **callback queue** and **registrar method**, which consumers of the deferral may use to add callbacks at any time. However, the deferral will react to a callback addition differently according to its state. While in the _unresolved_ state, callbacks are simply stored for later. Once the corresponding **resolver method** of a particular queue is called, the deferral transitions to its associated _resolved_ substate, the functions in that queue are executed, and all other queues are emptied. Thereafter, if new callbacks are added to the queue of the selected substate, they will be executed immediately, while callbacks subsequently added to any of the other queues will be ignored.


## Features

### Early binding

When a deferral is resolved it is commonly desirable to specify a context and set of arguments that will be applied to the callbacks. An unresolved `Deferral` provides the chainable method `as()` that will set the resolution context to be used when the deferral is later resolved. The arguments may be set in this manner as well with the method `given()`, which takes an array. These allow parts of the deferral's future resolution state to be set early, if they are known, and the deferral to be resolved agnostically later.

For example:

	Deferral().as( context ).affirm( arg1, arg2, ... );

which is equivalent to

	Deferral().as( context ).given([ arg1, arg2, ... ]).affirm();

both of which might compare with

	jQuery.Deferred().resolveWith( context, arg1, arg2, ... );

### Arity

`Deferral` supports _n-ary_ futures, in that any number of possible resolution states may be defined. An instantiation of `Deferral` may include its own one-to-one mapping of callback queues to resolver methods. A typical pattern is a _binary_ deferral that names two queues, such as `yes` and `no`, which map to resolver methods that could be named `affirm` and `negate`; this could be constructed like so:

	Deferral({ yes: 'affirm', no: 'negate'});

This can be extended further if more outcomes are to be accounted for:

	Deferral({ yes: 'affirm', no: 'negate', maybe: 'punt', confused: 'waffle', distracted: 'squirrel' });

Alternatively, if we wish to mimic the syntax of the jQuery Deferred object, we are also free to create:

	Deferral({ done: 'resolve', fail: 'reject' });

### Subtypes

Most applicable use cases for `Deferral` are served by its built-in formal subtypes. As introduced above, the most common usage is the `BinaryDeferral` at `Deferral.Binary` that names two callback queues, `yes` and `no`, invoked by calling `affirm()` or `negate()`, respectively. The default implementation of `Deferral` returns this binary subtype.

	var d = Deferral(); // BinaryDeferral
	d.yes( fn1 ).no( fn2 ); // === d.then( fn1, fn2 )
	d.as( context ).given( args ).affirm(); // === fn1.apply( context, args )

For applications in which there exists only one possible outcome, there is the `UnaryDeferral` at `Deferral.Unary`, which contains a single callback queue, `resolved`, invoked by calling `resolve()`.

	var d = Deferral.Unary(); // UnaryDeferral
	d.resolved( fn1, fn2 ); // === d.always( fn1, fn2 )
	d.as( context ).resolve( arg ); // === ( fn1.call( context, arg ), fn2.call( context, arg ), d )
	
There is also the special case where it may be desirable to work with a deferral in which all added callbacks are executed immediately; for this there is the `NullaryDeferral` at `Deferral.Nullary`. Effectively equivalent to a "pre-resolved" deferral, a nullary deferral has no callback queue or resolver method, but does provide conformance to the fundamental promise interface via `then()` and `promise()`. In addition, `empty()` is obviated, and methods `as()` and `given()` are defunct, with context and arguments for callbacks instead provided as arguments of the `NullaryDeferral` constructor:

	var d = Deferral.Nullary( asContext, givenArguments ); // NullaryDeferral
	d.then( fn ); // === ( fn1.apply( asContext, givenArguments ), d.promise() )


## Remarks

### Terminology

In particular, those familiar with the jQuery `Deferred` implementation may note a difference in usage regarding the notion of "resolved". Whereas to `resolve()` a jQuery `Deferred` instance implies a "successful" outcome, `Deferral` considers _resolved_ to denote only the opposite of _unresolved_, that the deferral has transitioned into its final resolution state, without implication as to success or failure or any concept of precisely _which_ state that is. In the case of the default type `BinaryDeferral`, which compares most directly to a jQuery `Deferred`, rather than being either `resolve`d or `reject`ed, it may be either `affirm`ed or `negate`d, as alluded to above. (Note however that the `UnaryDeferral` type _does_ in fact use `resolve` as its resolution method, which stands to reason given its one possible resolution state.)


## Methods

### Interfacing

#### promise()

Returns a `Promise`, a limited interface into the deferral that allows callback registration and resolution state querying.


### Querying

#### map()

Returns a hashmap relating the names of the deferral's callback queues to the names of their corresponding resolver methods.

#### queueNames()

Returns an Array that is an ordered list of the names of the deferral's callback queues.

#### did( `String` resolver )

Returns `true` if the deferral has been resolved using the specified `resolver` method. Returns `false` if it was resolved to a different resolution substate, and returns `undefined` if it is still unresolved.

#### resolution()

Returns the deferral's resolution in the form of the `String` name of the corresponding callback queue. Returns `undefined` if the deferral is still unresolved.

#### resolution( `String` test )

Returns `true` if the deferral's `resolution()` matches `test`. Returns `false` if the deferral was otherwise resolved, and returns `undefined` if it is still unresolved.


### Registration

Methods listed here return a `Promise` to this deferral.

#### (_registrar_)( `Function` callback | `Array` callbacks, ... )

Administers the supplied callback functions according to the deferral's state:
	
* In the unresolved state, the callbacks are registered to the corresponding queue, and will be called if the deferral is later resolved accordingly.
		
* If the deferral has already been resolved accordingly, the callbacks are called immediately.
		
* If the deferral has been otherwise resolved, the callbacks are discarded.
		
Values for built-in `Deferral` subtypes:
	
* `UnaryDeferral` : _registrar_ = { `resolved` }
		
* `BinaryDeferral` : _registrar_ = { `yes` | `no` }

#### then( `Function` callback | `Array` callbacks, ... )

Registers callbacks as above to each callback queue in order, such that the indices of the local `arguments` correspond with the array returned by `queueNames()`.

#### always( `Function` callback | `Array` callbacks, ... )

Registers callbacks to all queues, ensuring they will be called no matter how the deferral is resolved.


### Sequencing

#### pipe( `Function` callback | `Array` callbacks, ... )

Registers callbacks to a separate new deferral, whose resolver methods are registered to the queues of this deferral (`this`), and returns a promise bound to the succeeding deferral. This arrangement forms an ad-hoc **pipeline**, which can be extended indefinitely with chained calls to `pipe`. (Note the distinction between this ad-hoc pipeline and the formal `Pipeline` type described below.) Once resolved, the original deferral (`this`) passes its resolution state, context and arguments on to the succeeding deferral, whose callbacks may then likewise dictate the resolution parameters of its succeeding `pipe`d deferral, and so on.

Synchronous callbacks that return immediately will cause the succeeding deferral to resolve immediately, with the same resolution state and context from its receiving deferral, and the callback's return value as its lone resolution argument. Asynchronous callbacks that return their own promise or deferral will cause the succeeding deferral to resolve similarly once the callback's own deferral is resolved.


### Concurrency

#### when()

Facilitates parallel execution by binding together the fate of multiple promises. The promises represented by each supplied argument are overseen by a master binary deferral, such that the master deferral will be `affirm`ed only once each individual promise has itself resolved to the expected resolution, or will be `negate`d if any promise is otherwise resolved.

Returns a promise to this master deferral.

If `when` is called as a method of an unresolved binary deferral, then that deferral is used as the master deferral; otherwise, a new binary deferral is created for this purpose. The method is also available as a static member of the `Deferral` constuctor.

By default, `when` monitors the promises for their implicitly affirmative resolution state, i.e., the state targeted by the first argument of `then()`. A specific resolution state can be supplied as a `String` at the last argument position in the `when()` call. For example, the promise returned by:

	var promise = Deferral.when( promiseA, promiseB, 'no' );

will `affirm` to the `yes` resolution if `promiseA` and `promiseB` are both eventually `negate`d to their respective `no` resolution states.


### Resolution

Methods listed here return the deferral itself.

#### as( `Object` context )

Sets the context in which all executed callbacks will be called after the deferral is resolved. Context may be overwritten any number of times prior to the deferral's resolution; if not specified, the context defaults to the deferral itself. After resolution, the context is frozen; subsequent calls to `as` have no effect.

#### given( `Array` args )

Preloads resolution arguments in an unresolved deferral. Like `as()` for context, resolution arguments may be overwritten with `given` any number of times prior to the deferral's resolution, but after resolution the arguments are frozen, and subsequent calls to `given` have no effect. Will be overridden if arguments are included with a call to one of the _resolver_ methods.

#### (_resolver_)( ...arguments )

Resolves the deferral to the associated resolution substate, executing all registered callbacks for the corresponding queue, now and in the future, in the context specified previously via `as()`, with arguments supplied here as `...arguments` if included, or those specified previously via `given()`.

Values for built-in `Deferral` subtypes:
	
* `UnaryDeferral` : _resolver_ = { `resolve` }
		
* `BinaryDeferral` : _resolver_ = { `affirm` | `negate` }

#### empty()

Clears all callback queues.



# Promise

At any time a deferral can issue a partial interface to itself in the form of a **promise**, which contains a subset of the deferral's methods. Consumers of the promise can use it to make additions to the associated deferral's callback queues, and to query its resolution state, but cannot use it to directly alter the state by resolving the deferral.

As an example, a promise issued by the default `Deferral` will include `yes` and `no` methods for adding callbacks, but will not include the `affirm` or `negate` methods that would resolve the deferral.

Because a deferral is effectively an extension of its associated promise, in most cases it is possible for a `Deferral` to be substituted where `Promise` is called for.



# Pipeline

Deferrals facilitate the use of **continuations** to create a special type of operation `Pipeline`, which executes a sequence of synchronous or asynchronous functions in order, passing a set of arguments from one to the next as each operation completes.

Synchronous functions must return the array of arguments to be relayed on to the next operation; asynchronous functions must return a `Promise` to a `Deferral` that will be resolved at some point in the future.


## Remarks

### Considerations of using synchronous versus asynchronous continuations

A sequence of short synchronous operations can be processed more quickly since its operations continue immediately. However, because immediate continuations accumulate on the stack, and JavaScript does not employ tail-call optimization, these sequences incur a memory overhead that may become problematic as more synchronous operations are strung together. In addition, because contiguous synchronous operations are processed within a single **frame**, or turn of the event loop, too long a sequence could have a significant impact on the frame _rate_, which on the client may include noticeable interruptions to user experience.

Asynchronous operations advance through the pipeline no faster than one operation per frame, but this has the advantages of not polluting the stack and of long sequences not prolonging the duration of the frame in which it's executing.

Synchronous and asynchronous operations can be mixed together arbitrarily to provide granular control over this balance of immediacy versus frame imposition.

### Comparison to Deferral().pipe()

`Pipeline` and `pipe()` are conceptually similar, in that both arrange a succession of deferrals using continuation-style passing to relay a set of arguments from one deferral to the next. With `pipe()`, this can be arranged on the fly given any promise or deferral; however, `Pipeline` consumes stack space more efficiently when processing synchronous functions.

## Methods

### Array methods

Each method in this section mirrors that of `Array`, acting upon the internal array of operation functions contained within the pipeline; `length` is an exception in that it is a method rather than a property, although it is accessible as such via `valueOf`.

#### push
#### pop
#### shift
#### unshift
#### reverse
#### splice
#### length

### Interfacing

#### promise

Returns a promise to the internal binary deferral, which will be `affirm`ed after each item in the pipeline has itself been affirmatively resolved, or `negate`d if any item is non-affirmatively resolved.

### Querying state

#### operation

Returns the currently running or most recently completed operation.

#### args

Returns the arguments passed to the most recent operation function.

#### isRunning

Returns a boolean indicating whether an operation is currently underway.

### Control

Methods in this section return the `Pipeline` itself.

#### start( ...arguments )

Starts execution of operations through the pipeline, passing any supplied arguments to the first operation function.

#### pause

Commands the pipeline to pause execution after the currently executing operation completes.

#### resume

Resumes execution, or cancels a pending `pause` command.

#### stop

Stops execution and resolves the pipeline's deferral.


## Examples

* [This unit test](https://github.com/nickfargo/deferral.js/blob/master/test/unit/Pipeline.test.js) provides a step-by-step demonstration of a `Pipeline` at work. It mixes together both synchronous and asynchronous operations, and illustrates some of the tail-call considerations mentioned above.



# Multiplex

A **multiplex** employs a specific number of concurrent pipelines to process an array of operations in parallel.


## Remarks

### Comparison to Deferral.when()

It is worth nothing that the mechanism of `when` is essentially an infinite-width multiplex, built with a simpler construct. Whenever it is certain that concurrency limits are unnecessary, `when` should be used instead of `Multiplex`.

## Methods

#### promise

Returns a promise to the internal deferral that will be resolved once all of the constituent pipelines have been resolved.

#### width ()

Returns the upper limit on the number of concurrent pipelines.

#### width ( n )

Sets and returns a new upper limit on the number of concurrent pipelines. Widening a running multiplex will automatically start the additional pipelines. Narrowing the multiplex may not take effect immediately; the necessary number of pipelines will be terminated only once each has completed its current operation.

#### start

Creates and starts the necessary number of pipelines, limited to `width`, given the supplied `arguments`.

#### stop

Stops execution and resolves the multiplex's deferral.



# Procedure

A **procedure** employs `Pipeline`, `when`, and `Multiplex` to describe combinations of serial and parallel execution flows. It is constructed by grouping multiple functions into a nested array structure of arbitrary depth, where:

* An array literal `[ ]` represents a group of functions to be executed in a serial queue using a `Pipeline`.

* A **double array literal** `[[ ]]` represents a group of functions to be executed as a parallel set using a `when` invocation.

* A **numerically-keyed array object literal** `{n:[ ]}` represents a group of functions to be executed in parallel, up to `n` items concurrently, using a `Multiplex` of width `n`.

Constructor syntax resembles the following, where any of the pipe (`|`)–separated literals can be further nested where indicated by ellipses (`...`):

	var p = Procedure( [ ... ] | [[ ... ]] | {2:[ ... ]} );


## Methods

#### promise

Returns a promise to the internal deferral that will be resolved once the procedure is completed.

#### start

Initiates the procedure. (Does not currently define behavior for arguments.)

## Examples

In the following exmaple, a procedure is constructed from both parallel and serial sets of asynchronous functions that return promises. Each function must execute in the order indicated by its specific `n` value for the procedure to complete successfully. Note in particular the timing sequence going from `fn(3)` to `fn(6)`, illustrating the consequences of nesting parallel and serial sets inside one another.

	var number = 0;
	
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
	
The next example further illustrates this principle using a significantly more complex graph. Again, each function must execute in the proper order for the procedure to complete successfully (this time with a final `number` value of `22`). Even amidst the apparent tangle, the logic of the execution order indicated is discernable, keeping in mind the distinction that the function elements of a parallel set are invoked as soon as possible, while elements within a series must await the completion of their preceeding element.

	var number = 0;

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
			[[
				fn(3),
				fn(4),
				[
					fn(5),
					[[
						fn(11),
						fn(12),
						[[ fn(13), fn(14) ]]
					]],
					fn(17),
					[
						fn(18),
						fn(19)
					]
				],
				fn(6),
				[[
					fn(7),
					[ fn(8), fn(15) ]
				]],
				fn(9)
			]],
			[ fn(10), fn(16) ]
		]],
		[ fn(20), fn(21) ],
		fn(22)
	])
		.start()
		.then( function () {
			window.console && console.log( number ); // 22
		});

## Future directions

_Comment about flowing arguments through the procedure via `start()`, similar to `Pipeline`_

_Should `when` be built further to save return values of its elements and apply a reduce function over them?_