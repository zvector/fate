# Objects

## Deferral

A `Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

A deferral is characterized by its **resolution state**. Initially the deferral is in the _unresolved_ state; at some time in the future, it will irreversibly transition into one of possibly several _resolved_ substates. 

Each resolved substate is associated with a distinct **callback queue**. Consumers of the deferral may add callbacks to any queue at any time, but the deferral will react differently according to its state. While in the _unresolved_ state, callbacks are simply stored for later. When the deferral transitions to a _resolved_ substate, the functions in the queue associated with that state are executed, and all other queues are emptied. Thereafter, if new callbacks are added to the queue of the selected substate, they will be executed immediately, while callbacks subsequently added to any of the other queues will be ignored.

Any instantiation of `Deferral` may be defined with its own one-to-one mapping of callback queues to resolver methods, allowing for the definition of any number of resolved substates.

`Deferral` also includes built-in subtypes of itself. For applications in which there exists only one possible outcome, there is the `UnaryDeferral`, in which the deferral names a single callback queue, `resolved`, which is realized by calling `resolve()`. More common is the `BinaryDeferral` that names two callback queues, `yes` and `no`, which are realized by calling `affirm()` or `negate()`, respectively; the default implementation of `Deferral` returns this binary subtype. 

### Methods

`promise()`

> Returns a `Promise`, a limited interface into the deferral that allows callback registration and resolution state querying.

#### Structure querying

`map()`

> Returns a hashmap relating the names of the deferral's callback queues to the names of their corresponding resolver methods.

`queueNames()`

> Returns an Array that is an ordered list of the names of the deferral's callback queues.

#### Resolution state querying

`did( String resolver )`

> Returns `true` if the deferral has been resolved using the specified `resolver` method. Returns `false` if it was resolved to a different resolution substate, and returns `undefined` if it is still unresolved.

`resolution()`

> Returns the deferral's resolution in the form of the `String` name of the corresponding callback queue. Returns `undefined` if the deferral is still unresolved.

`resolution( String test )`

> Returns `true` if the deferral's `resolution()` matches `test`. Returns `false` if the deferral was otherwise resolved, and returns `undefined` if it is still unresolved.

#### Callback registration

Methods listed here return a `Promise` to this deferral.

_registrar_`( Function callback | Array callbacks, ... )`

> Administers the supplied callback functions according to the deferral's state:
	
>	* In the unresolved state, the callbacks are registered to the corresponding queue, and will be called if the deferral is later resolved accordingly.
		
>	* If the deferral has already been resolved accordingly, the callbacks are called immediately.
		
>	* If the deferral has been otherwise resolved, the callbacks are discarded.
		
> Values for built-in `Deferral` subtypes:
	
>	* `UnaryDeferral` : _registrar_ = { `resolved` }
		
>	* `BinaryDeferral` : _registrar_ = { `yes` | `no` }

`then( Function callback | Array callbacks, ... )`

> Registers callbacks as above to each callback queue in order, such that the indices of the local `arguments` correspond with the array returned by `queueNames()`.

`always( Function callback | Array callbacks, ... )`

> Registers callbacks to all queues.

`pipe( Function callback | Array callbacks, ... )`

> Arranges callbacks in a serially-executing **pipeline**, where the preceding callback's return value is supplied as the succeeding callback's argument. Local arguments correspond to the deferral's callback queues according to the same ordering as outlined for `then()`. For asynchronous callbacks that return a promise or deferral, the resolution state and execution state of this deferral will be passed to the successive deferral and its callbacks.

`empty()`

> Clears all callback queues.

#### Resolvers

Methods listed here return the deferral itself.

`as( Object context )`

> Sets the context in which all executed callbacks will be called after the deferral is resolved. Context may be overwritten any number of times prior to the deferral's resolution; if not specified, the context defaults to the deferral itself. After resolution, the context is frozen; subsequent calls to `as` have no effect.

`given( Array args )`

> Preloads resolution arguments in an unresolved deferral. Analogous to `as()` for the resolution context. Will be overridden if arguments are included with a call to one of the _resolver_ methods.

_resolver_`( arguments... )`

> Resolves the deferral to the associated resolution substate, executing all registered callbacks for the corresponding queue, now and in the future, in the context specified previously via `as()`, with arguments supplied here as `arguments...` if included, or those specified previously via `given()`.

> Values for built-in `Deferral` subtypes:
	
>	* `UnaryDeferral` : _resolver_ = { `resolve` }
		
>	* `BinaryDeferral` : _resolver_ = { `affirm` | `negate` }

## Promise

At any time a deferral can issue a partial interface to itself in the form of a `Promise`, which contains a subset of the deferral's methods. Consumers of the promise can use it to make additions to the associated deferral's callback queues, and to query its resolution state, but cannot use it to directly alter the state by resolving the deferral.

As an example, a promise issued by the default `Deferral` will include `yes` and `no` methods for adding callbacks, but will not include the `affirm` or `negate` methods that would resolve the deferral.

## Queue

Deferrals facilitate the use of **continuations** to create a `Queue`, which executes a sequence of synchronous or asynchronous functions in order, passing a set of arguments from one to the next as each operation completes.

Synchronous functions must return the array of arguments to be relayed on to the next operation; asynchronous functions must return a `Promise` to a `Deferral` that will be resolved, presumably in the affirmative, at some point in the future.

### Considerations of synchronous versus asynchronous operations

A sequence of synchronous operations can be processed more quickly since its operations continue immediately. However, because immediate continuations accumulate on the stack, and JavaScript does not employ tail-call optimization, these sequences incur a memory overhead that may become problematic as more synchronous operations are strung together. In addition, because contiguous synchronous operations are processed within a single _frame_, or turn of the event loop, too long a sequence could have a significant impact on the frame _rate_, including noticeable interruptions to user experience on the client.

Asynchronous operations advance the queue no faster than one operation per frame, but this has the advantages of not polluting the stack and not prolonging the duration of the frame in which it's executing.

Synchronous and asynchronous operations can be mixed together arbitrarily to provide granular control over this balance of immediacy versus resource consumption.
