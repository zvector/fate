<<<<<<< HEAD
# deferral-promise

## Objects

### Deferral

A `Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

A deferral is characterized by its **resolution state**. Initially the deferral is in the *unresolved* state; at some time in the future, it may be transitioned into any one of possibly several *resolved* substates. This transition is final; after it has taken place the deferral may not transition again. By default, `Deferral` models a simple decision branch by defining two possible resolutions, `yes` and `no`, which are realized by calling `affirm` or `negate`, respectively.

Each resolved substate is associated with a distinct **callback queue**. Consumers of the deferral may add callbacks to any queue at any time, but the deferral will react differently according to its state. In the *unresolved* state, callbacks are simply stored for later; when the deferral transitions to a *resolved* substate, the functions in the queue associated with that state are executed, and all other queues are emptied. Thereafter, if new callbacks are added to the queue of the selected substate, they will be executed immediately, while callbacks subsequently added to any of the other queues will be ignored.

### Promise

At any time a deferral can issue a `Promise`. This object is a subinterface of the deferral to which it is bound, allowing holders of the promise to make additions to the associated deferral's callback queues and to query its resolution state, but not to directly alter the state by resolving the deferral.

### OperationQueue

Using deferrals facilitates the use of **continuations** to create an `OperationQueue`, which executes a sequence of functions in order, passing a set of arguments from one to the next as each operation completes.

Functions supplied as operations may be synchronous, in which case they must return the array of arguments to be relayed on to the next operation; or they may be asynchronous, returning a `Promise` to a `Deferral` that will be `affirm`ed at some point in the future.

#### Considerations of synchronous versus asynchronous

A sequence of synchronous operations can be processed more quickly since its operations continue immediately. However, because immediate continuations accumulate on the stack, and JavaScript does not employ tail-call optimization, these sequences incur a memory overhead that may become problematic as more synchronous operations are strung together. In addition, because contiguous synchronous operations are processed within a single *frame*, or turn of the event loop, too long a sequence may result in noticeable interruptions to user experience.
=======
# Objects

## Deferral

A `Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

A deferral is characterized by its **resolution state**. Initially the deferral is in the *unresolved* state; at some time in the future, it is expected to transition into one of possibly several *resolved* substates. This resolution transition is final; after it has taken place the deferral may not transition again.

Each resolved substate is associated with a distinct **callback queue**. Consumers of the deferral may add callbacks to any queue at any time, but the deferral will react differently according to its state. In the *unresolved* state, callbacks are simply stored for later. When the deferral transitions to a *resolved* substate, the functions in the queue associated with that state are executed, and all other queues are emptied. Thereafter, if new callbacks are added to the queue of the selected substate, they will be executed immediately, while callbacks subsequently added to any of the other queues will be ignored.

By convention, a deferral's first resolved substate is assumed to represent an *affirmative* resolution, and the second, if present, is assumed to represent a *negative* resolution. The default implementation of `Deferral` uses this convention to model a simple decision branch: it names two callback queues, `yes` and `no`, which are realized by calling `affirm` or `negate`, respectively.

### Methods

* promise

#### Structure querying
* map
* queueNames

#### Resolution state querying
* did
* resolution

#### Callback registration
* ( yes | no | ... )
* then
* always
* pipe
* empty

#### Resolvers
* as
* ( affirm | negate | ... )


## Promise

At any time a deferral can issue a partial interface to itself in the form of a `Promise`, which contains a subset of the deferral's methods. Consumers of the promise can use it to make additions to the associated deferral's callback queues, and to query its resolution state, but cannot use it to directly alter the state by resolving the deferral.

As an example, a promise issued by the default `Deferral` will include `yes` and `no` methods for adding callbacks, but will not include the `affirm` or `negate` methods that would resolve the deferral.

## Queue

Deferrals facilitate the use of **continuations** to create a `Queue`, which executes a sequence of synchronous or asynchronous functions in order, passing a set of arguments from one to the next as each operation completes.

Synchronous functions must return the array of arguments to be relayed on to the next operation; asynchronous functions must return a `Promise` to a `Deferral` that will be resolved, presumably in the affirmative, at some point in the future.

### Considerations of synchronous versus asynchronous operations

A sequence of synchronous operations can be processed more quickly since its operations continue immediately. However, because immediate continuations accumulate on the stack, and JavaScript does not employ tail-call optimization, these sequences incur a memory overhead that may become problematic as more synchronous operations are strung together. In addition, because contiguous synchronous operations are processed within a single *frame*, or turn of the event loop, too long a sequence could have a significant impact on the frame *rate*, including noticeable interruptions to user experience on the client.
>>>>>>> 2011-08-07

Asynchronous operations advance the queue no faster than one operation per frame, but this has the advantages of not polluting the stack and not prolonging the duration of the frame in which it's executing.

Synchronous and asynchronous operations can be mixed together arbitrarily to provide granular control over this balance of immediacy versus resource consumption.
