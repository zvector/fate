


# Deferral

`Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

### Background

A **deferral** is an extension of the _promise_ pattern. Implementations of this pattern have gained wide usage in JavaScript recently: in early 2011 **jQuery** with version 1.5 added its own [Deferred](http://api.jquery.com/category/deferred-object/) object that it both exposes and uses internally to power features such as `$.ajax`; this in turn was based largely on a similar [Deferred](http://dojotoolkit.org/api/1.3/dojo/Deferred) implementation that was already present in **dojo**. Various similar constructs are exceedingly common in many other libraries and frameworks as well.

### Overview

A deferral collects future possible execution paths, in the form of callbacks, that may be performed later pending the deferral's resolution to a particular outcome. Which path is taken is thus characterized by the deferral's **resolution state**. Initially, the deferral is said to be in an _unresolved_ state; then at some point in the future, it will irreversibly transition into one of its _resolved_ substates. 

Each resolved substate is associated with a distinct **callback queue**. Consumers of the deferral may add callbacks to any queue at any time, however the deferral will react differently according to its state. While in the _unresolved_ state, callbacks are simply stored for later. When the deferral transitions to a _resolved_ substate, the functions in the queue associated with that state are executed, and all other queues are emptied. Thereafter, if new callbacks are added to the queue of the selected substate, they will be executed immediately, while callbacks subsequently added to any of the other queues will be ignored.

### Features

#### Arity

`Deferral` supports _n-ary_ futures, in that any number of possible resolution states may be defined. An instantiation of `Deferral` may include its own one-to-one mapping of callback queues to resolver methods.

	Deferral({ yes: 'affirm', no: 'negate', maybe: 'punt', confused: 'waffle', distracted: 'squirrel' });

To compare with the syntax of the jQuery Deferred object, we are also free to create:

	Deferral({ done: 'resolve', fail: 'reject' });

#### Subtypes

Most applicable use cases, however, are served by built-in subtypes of `Deferral`. For applications in which there exists only one possible outcome, there is the `UnaryDeferral`, in which the deferral names a single callback queue, `resolved`, which is realized by calling `resolve()`. More common is the `BinaryDeferral` that names two callback queues, `yes` and `no`, which are realized by calling `affirm()` or `negate()`, respectively; the default implementation of `Deferral` returns this binary subtype. 

#### as, given

When a deferral is resolved it is commonly desirable to specify a context and set of arguments that will be applied to the callbacks. An unresolved `Deferral` provides the chainable method `as()` that will set the resolution context to be used when the deferral is later resolved. The arguments may be set in this manner as well with the method `given()`, which takes an array. These allow parts of the deferral's resolution state to be set early, if they are known, and then resolved agnostically later.

For example, compare:

	Deferral().as( context ).affirm( arg1, arg2, ... );

or

	Deferral().as( context ).given([ arg1, arg2, ... ]).affirm();

which might compare with

	jQuery.Deferred().resolveWith( context, arg1, arg2, ... );





## Methods

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


### Sequencing

#### pipe( `Function` callback | `Array` callbacks, ... )

Registers callbacks to a separate deferral, whose resolver methods are registered to the queues of this deferral, and returns a promise bound to the succeeding deferral. This arrangement forms a **pipeline** structure, which can be extended indefinitely with chained calls to `pipe`. Once resolved, the original deferral (`this`) passes its resolution state, context and arguments on to the succeeding deferral, whose callbacks may then likewise dictate the resolution parameters of a further `pipe`d deferral, and so on.

Synchronous callbacks that return immediately will cause the succeeding deferral to resolve immediately, with the same resolution state and context from its receiving deferral, and the callback's return value as its lone resolution argument. Asynchronous callbacks that return their own promise or deferral will cause the succeeding deferral to resolve similarly once the callback's own deferral is resolved.



# Promise

At any time a deferral can issue a partial interface to itself in the form of a **promise**, which contains a subset of the deferral's methods. Consumers of the promise can use it to make additions to the associated deferral's callback queues, and to query its resolution state, but cannot use it to directly alter the state by resolving the deferral.

As an example, a promise issued by the default `Deferral` will include `yes` and `no` methods for adding callbacks, but will not include the `affirm` or `negate` methods that would resolve the deferral.

Because `Promise` is effectively a "supertype" of its associated deferral, in most cases it is possible for a `Deferral` to be substituted where a `Promise` is called for.



# Queue

Deferrals facilitate the use of **continuations** to create a `Queue`, which executes a sequence of synchronous or asynchronous functions in order, passing a set of arguments from one to the next as each operation completes.

Synchronous functions must return the array of arguments to be relayed on to the next operation; asynchronous functions must return a `Promise` to a `Deferral` that will be resolved at some point in the future.


### Considerations of using synchronous versus asynchronous continuations

A sequence of short synchronous operations can be processed more quickly since its operations continue immediately. However, because immediate continuations accumulate on the stack, and JavaScript does not employ tail-call optimization, these sequences incur a memory overhead that may become problematic as more synchronous operations are strung together. In addition, because contiguous synchronous operations are processed within a single **frame**, or turn of the event loop, too long a sequence could have a significant impact on the frame _rate_, which on the client may include noticeable interruptions to user experience.

Asynchronous operations advance the queue no faster than one operation per frame, but this has the advantages of not polluting the stack and of long sequences not prolonging the duration of the frame in which it's executing.

Synchronous and asynchronous operations can be mixed together arbitrarily to provide granular control over this balance of immediacy versus frame imposition.



# when()

The `when` function is a construct that facilitates parallel execution by binding together the fate of multiple promises. The promises represented by each supplied argument are overseen by a master binary deferral, such that the master deferral will be `affirm`ed only once each individual promise has itself resolved to the expected resolution, or will be `negate`d if any promise is otherwise resolved.

By default, `when` monitors the promises for their implicitly affirmative resolution state, i.e., the state targeted by the first argument of `then()`. A specific resolution state can be supplied as a `String` at the last argument position in the `when()` call. For example, the promise returned by:

	var promise = when( promiseA, promiseB, 'no' );

will `affirm` to the `yes` resolution if `promiseA` and `promiseB` are both eventually `negate`d to their respective `no` resolution states.



# Procedure

A **procedure** employs `Queue` and `when` to describe combinations of serial and parallel execution flows. It is constructed by grouping multiple functions into a nested array structure of arbitrary depth, where a nested array (literal `[ ]`) represents a group of functions to be executed in a serial queue (using the promise to a `Queue` of the grouped functions), and a nested **double array** (literal `[[ ]]`) represents a group of functions to be executed as a parallel set (using the promise returned by a `when` invocation of the grouped functions).

In the following example, a procedure is created from numerous delayed functions arranged in an arbitrarily complex graph, such that for the procedure to complete successfully (with `number === 22`), each function must execute in order as specified by its unique `n` value. Even amidst the tangle, the logic of the execution order indicated is discernable, keeping in mind the distinction that the function elements of a parallel set are invoked as soon as possible, while elements within a series must await the delay of their prior element.

	( function () {
		var number = 0;

		function fn ( n ) {
			return function () {
				var deferral = new Deferral.Unary;
				setTimeout( function () { n === ++number && deferral.resolve(); }, 100 );
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
			.then( function () { window.console && console.log( number ); } );
	})();
	
_comment about flowing arguments through via `start()`_
