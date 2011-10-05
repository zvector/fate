( function ( undefined ) {

var	global = this,
	
	Z =	typeof require !== 'undefined' ? require('zcore') : global.Z,
	
	Fate = Z.extend( Z.env.server ? exports : {}, {
		version: '0.0.1',
	
		Deferral: Deferral,
		Promise: Promise,
		Pipeline: Pipeline,
		Multiplex: Multiplex,
		Procedure: Procedure,
	
		noConflict: ( function () {
			var autochthon = global.Fate;
			return function () {
				global.Fate = autochthon;
				return this;
			};
		})()
	});

Z.env.client && ( global['Fate'] = Fate );

/**
 * `Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.
 * 
 * @param Object potential : Hashmap whose entries represent the set of resolved substates for the deferral;
 * 		keys specify a name for the substate's callback queue, and values specify a name for the
 * 		resolution method used to transition to that substate and execute its associated callbacks.
 * @param Function fn : A function that will be executed immediately in the context of the deferral.
 * @param Array args : Array of arguments to be passed to `fn`.
 */
function Deferral ( potential, fn, args ) {
	if ( !( this instanceof Deferral ) ) {
		return new Deferral( potential, fn, args );
	}
	if ( potential === undefined || Z.isFunction( potential ) ) {
		return new Deferral.Binary( potential, fn );
	}
	
	
	var	self = this,
		callbacks,
		resolution, resolutionContext, resolutionArguments,
		register, resolve,
		promise;
	
	function setResolution ( name ) { return name in potential && ( resolution = name ); }
	function getResolutionContext () { return resolutionContext; }
	function getResolutionArguments () { return resolutionArguments; }
	function setResolutionArguments ( args_ ) { return resolutionArguments = args_; }
	
	
	Z.extend( this, {
		resolution: Z.stringFunction( function ( test ) {
			return test ? test === resolution || ( test in potential ? false : undefined ) : resolution;
		}),
		$resolution: function ( test ) {
			if ( test === undefined ) {
				return {
					name: '',
					context: resolutionContext,
					arguments: resolutionArguments
				};
			}
		},
		did: function ( resolver ) {
			return resolver ? !!resolution && resolver === potential[ resolution ] : !!resolution;
		},
		promise: function () {
			return promise || ( promise = new Promise( this ) );
		}
	});
	
	/*
	 * Handle the special case of a nullary deferral, which behaves like a "pre-resolved" unary deferral,
	 * where there are no callback queues, no registrar or resolver methods, but functions added
	 * through `then`, `always`, etc., will simply be executed immediately. No `as()` or `given()` methods
	 * are available either; instead the resolution context and resolution arguments are provided in the
	 * constructor call, after the `null` first argument, at positions 1 and 2, respectively.
	 */
	if ( potential === null ) {
		resolution = true;
		this.potential = this.futures = Z.noop;
		this.as = this.given = this.empty = Z.getThis;
		this.then = Deferral.privileged.invoke( this, null )
			( resolutionContext = fn, resolutionArguments = args );
		this.always = function () { return this.then( Z.slice.call( arguments ) ); };
	}
	
	// Normal (n > 0)-ary deferral
	else {
		Z.extend( this, {
			potential: function () {
				return Z.extend( {}, potential );
			},
			futures: function () {
				return Z.keys( potential );
			},
			as: function ( context ) {
				resolutionContext = context;
				return this;
			},
			given: function ( args ) {
				resolutionArguments = args;
				return this;
			},
			empty: function () {
				function empty ( obj ) {
					var key, value;
					for ( key in obj ) if ( Z.hasOwn.call( obj, key ) ) {
						Z.isPlainObject( value = obj[ key ] ) ?
							empty( value ) :
							( obj[ key ] = [] );
					}
				}
				empty( callbacks = Z.extend( {}, potential ) );
				return this;
			}
		});
		this.futures.toString = function () { return this.futures().join(' '); };
		
		this.empty();

		register = Deferral.privileged.register( this, callbacks );
		resolve = Deferral.privileged.resolve( this, callbacks, setResolution, getResolutionContext,
			getResolutionArguments, setResolutionArguments );
		
		Z.each( potential, function ( name, resolver ) {
			self[ name ] = register( name );
			self[ resolver ] = resolve( name );
		});
	
		register = resolve = null;
	
		fn && Z.isFunction( fn ) && fn.apply( this, args );
	}
}
Z.extend( true, Deferral, {
	privileged: {
		/**
		 * Produces a function that pushes callbacks onto one of the callback queues.
		 */
		register: function ( self, callbacks ) {
			return function ( resolution ) { // e.g. { 'yes' | 'no' }
				return function ( fn ) {
					Z.isFunction( fn ) && callbacks[ resolution ].push( fn ) ||
						Z.isArray( fn ) && Z.forEach( fn, self[ resolution ] );
					return self;
				};
			};
		},
		
		/**
		 * Produces a function that resolves the deferral, transitioning it to one of its resolved substates.
		 */
		resolve: function ( self, callbacks, setResolution, getResolutionContext, getResolutionArguments, setResolutionArguments ) {
			var	invokeFn = this.invoke( self, callbacks ),
				invokeAllFn = this.invokeAll( self, callbacks );
			
			return function ( resolution ) {
				return function () {
					var	name,
						potential = self.potential(),
						context = getResolutionContext(),
						args = arguments.length ? setResolutionArguments( Z.slice.call( arguments ) ) : getResolutionArguments();
					
					setResolution( resolution );
					
					/*
					 * The deferral has transitioned to a 'resolved' substate ( e.g. affirmed | negated ),
					 * so the behavior of its callback registration methods are redefined to reflect this.
					 * A closure preserves the current execution state as `context` and `args`; henceforth,
					 * callbacks that would be registered to the queue named `resolution` will instead be
					 * called immediately with the saved `context` and `args`, while subsequent callback
					 * registrations to any of the other queues are deemed invalid and will be discarded.
					 */
					self[ resolution ] = invokeFn( context, args );
					self[ potential[ resolution ] ] = self.as = self.given = Z.getThis;
					delete potential[ resolution ];
					for ( name in potential ) {
						self[ name ] = self[ potential[ name ] ] = Z.getThis;
					}
					
					invokeAllFn( context, args )( callbacks[ resolution ] );
					
					delete callbacks[ resolution ];
					for ( name in potential ) { delete callbacks[ name ]; }
					
					return self;
				};
			};
		},
		
		/**
		 * Produces a function that invokes a queued callback. In addition, when the deferral is
		 * resolved, the function returned here will become the callback registration method (e.g.,
		 * 'yes' | 'no') that corresponds to the deferral's resolution, such that registering a
		 * callback after the deferral is resolved will cause the callback to be invoked immediately.
		 */
		invoke: function ( deferral, callbacks ) {
			var self = this;
			return function ( context, args ) {
				var invokeAll = self.invokeAll( deferral, callbacks )( context, args );
				return function ( fn ) {
					try {
						Z.isFunction( fn ) ? fn.apply( context || deferral, args ) :
						Z.isArray( fn ) && invokeAll( fn );
					} catch ( nothing ) {}
					return deferral;
				};
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( deferral, callbacks ) {
			return function ( context, args ) {
				return function ( fns ) {
					var i = 0, l = fns.length,
						invoke = Deferral.privileged.invoke( deferral, callbacks )( context, args );
					while ( i < l ) {
						invoke( fns[ i++ ] );
					}
				};
			};
		}
	},
	
	prototype: {
		/**
		 * Unified interface for registering callbacks. Multiple arguments are registered to callback
		 * queues in respective order; e.g. `Deferral().then( fn1, fn2 )` registers `fn1` to the
		 * first queue (`yes`) and `fn2` to the second queue (`no`).
		 */
		then: function () {
			var	potential = Z.keys( this.potential() ),
				i, l;
			potential[0] === '' && potential.shift();
			for ( i = 0, l = Math.min( potential.length, arguments.length ); i < l; i++ ) {
				this[ potential[i] ]( arguments[i] );
			}
			return this;
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is affirmed or not.
		 */
		always: function () {
			var	name,
				potential = this.potential(),
				fns = Z.slice.call( arguments );
			for ( name in potential ) {
				this[ name ]( fns );
			}
			return this;
		},
		
		/**
		 * Registers callbacks to a separate deferral, whose resolver methods are registered to the
		 * queues of this deferral, and returns a promise bound to the succeeding deferral. This
		 * arrangement forms a pipeline structure, which can be extended indefinitely with chained
		 * calls to `pipe`. Once resolved, the original deferral (`this`) passes its resolution
		 * state, context and arguments on to the succeeding deferral, whose callbacks may then
		 * likewise dictate the resolution parameters of a further `pipe`d deferral, and so on.
		 * 
		 * Synchronous callbacks that return immediately will cause the succeeding deferral to
		 * resolve immediately, with the same resolution state and context from its receiving
		 * deferral, and the callback's return value as its lone resolution argument. Asynchronous
		 * callbacks that return their own promise or deferral will cause the succeeding deferral
		 * to resolve similarly once the callback's own deferral is resolved.
		 */
		pipe: function () {
			var	self = this,
				potential = this.potential(),
				key, resolver, fn,
				i = 0, l = arguments.length,
				next = new Deferral( potential );
			for ( key in potential ) {
				if ( i < l ) {
					resolver = potential[ key ];
					fn = arguments[ i++ ];
					this[ key ](
						Z.isFunction( fn ) ?
							function () {
								var key,
									result = fn.apply( this, arguments ),
									promise_ = result && Promise.resembles( result ) ?
										result.promise() : undefined;
								if ( promise_ ) {
									for ( key in potential ) {
										promise_[ key ]( next[ potential[ key ] ] );
									}
								} else {
									next.as( this === self ? next : this )[ resolver ]( result );
								}
							} :
							next[ resolver ]
					);
				} else break;
			}
			return next.promise();
		},
		
		/**
		 * Binds together the fate of all `promises` as evaluated against the specified `resolution`. Returns a
		 * `Promise` to a master `Deferral` that either: (1) will resolve to `yes` once all `promises` have
		 * individually been resolved to the specified `resolution`; or (2) will resolve to `no` once any one of the
		 * `promises` has been resolved to a different resolution. If no `resolution` is specified, it will default
		 * to that of the first defined callback queue (e.g. `yes` for a standard deferral).
		 */
		when: function ( /* promises..., [ resolution ] */ ) {
			var	promises = Z.flatten( Z.slice.call( arguments ) ),
				length = promises.length || 1,
				resolution,
				master = ( this instanceof BinaryDeferral && !this.did() ) ? this : new Deferral,
				list = [],
				i, promise, futures, affirmativeState, negativePotential, state;
			
			function affirmed ( promise_ ) {
				return function () {
					list.push( promise_ ) === length && master.affirm.apply( master, list );
				};
			}
			function negated ( promise_ ) {
				return function () {
					list.push( promise_ );
					master.negate.apply( master, list );
				};
			}
			
			if ( length > 1 && Z.type( promises[ length - 1 ] ) === 'string' ) {
				resolution = promises.pop();
				length--;
			}
			
			for ( i = 0; i < length; i++ ) {
				promise = promises[i];
				if ( promise instanceof Deferral || promise instanceof Promise ) {
					
					// (n > 0)-ary deferral: affirm for the matching resolution state and negate for any others
					if ( ( futures = promise.futures() ) && futures.length ) {
						
						// Determine which of this promise's resolution states is to be considered affirmative in this context
						affirmativeState = resolution || futures[0];
						
						// `negativePotential` is a map of resolution states not considered affirmative in this context
						if ( affirmativeState in ( negativePotential = promise.potential() ) ) {
							delete negativePotential[ affirmativeState ];
						} else {
							// Because this promise will never be resolved to match `resolution`, the master deferral
							// can be negated immediately
							list.push( promise );
							master.negate.apply( master, list );
							break;
						}
						
						promise[ affirmativeState ]( affirmed( promise ) );
						for ( state in negativePotential ) {
							promise[ state ]( negated( promise ) );
						}
					}
					
					// Nullary deferral: affirm immediately
					else {
						promise.then( affirmed( promise ) );
					}
				}
				
				// For foreign promise objects, we utilize the standard `then` interface
				else if ( Promise.resembles( promise ) ) {
					promise.then( affirmed( promise ), negated( promise ) );
				}
				
				// Coerce anything else into a nullary deferral.
				else {
					promises[i] = NullaryDeferral( master, promise );
					Z.isFunction( promise ) && promises[i].then( promise );
				}
			}
			
			return master.promise();
		}
	}
});
Deferral.when = Deferral.prototype.when;


function NullaryDeferral ( as, given ) {
	if ( !( this instanceof NullaryDeferral ) ) { return new NullaryDeferral( as, given ); }
	Deferral.call( this, null, as, given );
}
NullaryDeferral.prototype = Deferral.prototype;
Deferral.Nullary = NullaryDeferral;


function UnaryDeferral ( fn, args ) {
	if ( !( this instanceof UnaryDeferral ) ) { return new UnaryDeferral( fn, args ); }
	Deferral.call( this, { done: 'resolve' }, fn, args );
}
UnaryDeferral.prototype = Deferral.prototype;
Deferral.Unary = UnaryDeferral;


function BinaryDeferral ( fn, args ) {
	if ( !( this instanceof BinaryDeferral ) ) { return new BinaryDeferral( fn, args ); }
	Deferral.call( this, { yes: 'affirm', no: 'negate' }, fn, args );
}
BinaryDeferral.prototype = Deferral.prototype;
Deferral.defaultType = Deferral.Binary = BinaryDeferral;


/**
 * `Promise` is a limited interface into a `Deferral` instance, consisting of a particular subset of
 * the deferral's methods. Consumers of the promise are prevented from affecting the represented
 * deferral's resolution state, but they can use it to query its state and add callbacks.
 */
function Promise ( deferral ) {
	var self = this,
		list = Promise.methods.concat( deferral.futures() ),
		i = list.length;
	while ( i-- ) {
		( function ( name ) {
			self[ name ] = function () {
				var result = deferral[ name ].apply( deferral, arguments );
				return result === deferral ? self : result;
			};
		})( list[i] );
	}
	this.serves = function ( master ) { return master === deferral; };
}
Z.extend( true, Promise, {
	methods: 'then always pipe promise did resolution potential futures'.split(' '),
	
	// Used to test whether an object is or might be able to act as a Promise.
	resembles: function ( obj ) {
		return obj && (
			obj instanceof Promise ||
			obj instanceof Deferral ||
			Z.isFunction( obj.then ) && Z.isFunction( obj.promise )
		);
	}
});


/**
 * A **pipeline** executes a sequence of synchronous or asynchronous functions in order, passing a set of
 * arguments from one to the next as each operation completes.
 */
function Pipeline ( operations ) {
	if ( !( this instanceof Pipeline ) ) {
		return new Pipeline( operations );
	}
	
	var	self = this,
		context = self,
		operation,
		args,
		deferral,
		running = false,
		pausePending = false,
		events = Z.nullHash([ 'didOperation', 'willContinue' ]);
	
	function returnSelf () {
		return self;
	}
	
	function reset () {
		return deferral = ( new Deferral ).as( context );
	}
	
	function shift () {
		return operation = operations.shift();
	}
	
	function emit ( eventType ) {
		var	callbacks = events[ eventType ],
			i, l;
		if ( callbacks ) {
			for ( i = 0, l = callbacks.length; i < l; i++ ) {
				callbacks[i].call( self, { target: self, operation: operation, args: args } );
			}
		}
	}
	
	function continuation () {
		var result;
		if ( Z.isFunction( this ) ) {
			result = this.apply( self, arguments );
			if ( Promise.resembles( result ) ) {
				result.then(
					function () {
						args = Z.slice.call( arguments );
						emit( 'didOperation' );
						pausePending && ( running = pausePending = false );
						running && ( operation = operations[0] ) && emit( 'willContinue' );
						running && continuation.apply( shift(), args );
					},
					self.abort
				);
			} else {
				args = Z.slice.call( arguments );
				running && continuation.apply( shift(), Z.isArray( result ) ? result : [ result ] );
			}
		} else {
			args = Z.slice.call( arguments );
			self.stop();
		}
	}
	
	function as ( context_ ) {
		deferral.as( context = context_ );
		return self;
	}
	
	function given ( args_ ) {
		deferral.given( args = args_ );
		return self;
	}
	
	function start () {
		( !deferral || deferral.did() ) && reset();
		running = true;
		
		self.as = self.given = self.start = returnSelf;
		self.pause = pause, self.resume = resume, self.stop = stop, self.abort = abort;
		
		continuation.apply( shift(), arguments.length ? ( args = Z.slice.call( arguments ) ) : args );
		return self;
	}
	
	function pause () {
		pausePending = true;
		self.resume = resume, self.pause = returnSelf;
		return self;
	}
	
	function resume () {
		running = true, pausePending = false;
		self.pause = pause, self.resume = returnSelf;
		continuation.apply( shift(), args );
		return self;
	}
	
	function stop () {
		running = pausePending = false;
		
		self.as = as, self.given = given, self.start = start;
		self.pause = self.resume = self.stop = self.abort = returnSelf;
		
		deferral.given( args ).affirm();
		return self;
	}
	
	function abort () {
		running = pausePending = false;
		
		self.as = as, self.given = given, self.start = start;
		self.pause = self.resume = self.stop = self.abort = returnSelf;
		
		deferral.given( args ).negate();
		return self;
	}
	
	Z.forEach( Pipeline.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	Z.extend( this, {
		length: Z.valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		operation: function () { return operation; },
		args: function () { return Z.slice.call( args ); },
		isRunning: Z.valueFunction( function () { return running; } ),
		as: as,
		given: given,
		start: start,
		pause: returnSelf,
		resume: returnSelf,
		stop: returnSelf,
		abort: returnSelf,
		on: function ( eventType, fn ) {
			var callbacks = events[ eventType ] || ( events[ eventType ] = [] );
			return callbacks && callbacks.push( fn ) && this;
		}
	});
	
	reset();
}
Z.extend( Pipeline, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});


/**
 * A **multiplex** employs a specific number of concurrent pipelines to process an array of operations in
 * parallel. Its `width`, which is the maximum number of pipelines that are allowed to operate concurrently,
 * can be adjusted dynamically as the multiplex is running; this will cause pipelines to be automatically
 * added as necessary, or removed as necessary once their current operations complete.
 */
function Multiplex ( width, operations ) {
	if ( !( this instanceof Multiplex ) ) {
		return new Multiplex( width, operations );
	}
	if ( arguments.length === 1 ) {
		operations = width, width = operations.length;
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( self ),
		args,
		running = false,
		pipeCount = 0,
		first, last;
	
	function returnSelf () {
		return self;
	}
	
	function fill () {
		while ( pipeCount < width && operations.length ) {
			addPipe();
		}
	}
	
	function addPipe () {
		var pipe = Pipeline( operations )
			.on( 'didOperation', didOperation )
			.on( 'willContinue', willContinue )
		;
		last = last ? ( ( pipe.previous = last ).next = pipe ) : ( first = pipe );
		pipe.promise().always( function () {
			removePipe( pipe );
		});
		running && pipe.start.apply( pipe, args );
		pipeCount++;
		return pipe;
	}
	
	function removePipe ( pipe ) {
		var previous = pipe.previous, next = pipe.next;
		previous && ( previous.next = next ), next && ( next.previous = previous );
		previous || next || self.stop();
		return pipe;
	}
	
	function didOperation ( event ) {
		args = event.args;
	}
	
	function willContinue ( event ) {
		var pipe = event.target;
		if ( pipeCount > width ) {
			pipeCount--;
			pipe.stop();
		} else if ( pipeCount < width ) {
			// because operations may have been added
			fill();
		}
	}
	
	function as ( context ) {
		deferral.as( context );
		return self;
	}
	
	function given ( args_ ) {
		deferral.given( args = args_ );
		return self;
	}
	
	function start () {
		arguments.length && ( args = Z.slice.call( arguments ) );
		running = true;
		self.as = self.given = self.start = returnSelf, self.stop = stop, self.abort = abort;
		fill();
		return self;
	}
	
	function stop () {
		running = false;
		self.start = start, self.as = as, self.given = given, self.stop = self.abort = returnSelf;
		deferral.given( args ).affirm();
		return self;
	}
	
	function abort () {
		running = false;
		self.start = start, self.as = as, self.given = given, self.stop = self.abort = returnSelf;
		deferral.given( args ).negate();
		return self;
	}
	
	Z.forEach( Multiplex.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	Z.extend( this, {
		length: Z.valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		width: function ( value ) {
			if ( Z.isNumber( value = +value ) ) {
				width = value;
				fill();
			}
			return width;
		},
		isRunning: Z.valueFunction( function () { return running; } ),
		as: as,
		given: given,
		start: start,
		stop: returnSelf
	});
}
Z.extend( Multiplex, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});

/**
 * A **procedure** defines an execution flow by nesting multiple parallel and serial function arrays.
 * 
 * Input is accepted in the form of nested function arrays, of arbitrary depth, where an array
 * literal `[ ]` represents a group of functions to be executed in a serial queue using a `Pipeline`;
 * a **double array literal** `[[ ]]` represents a group of functions to be executed as a parallel
 * set using a `when` invocation; a **numerically-keyed object–bound array literal** `{n:[ ]}`
 * represents a group of functions to be executed in parallel, up to `n` items concurrently, using a
 * `Multiplex` of width `n`; and a **block literal** `['type', ... ]` represents a control structure,
 * where `type` may be a statement such as `if`, `while`, `for`, etc., any of which direct the flow
 * of asynchronous execution in a manner analogous to their respective language-level counterparts.
 */
function Procedure ( input, scope ) {
	if ( !( this instanceof Procedure ) ) {
		return new Procedure( input, scope );
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( scope || ( scope = {} ) ),
		procedure = parse.call( scope, input );
	
	function downscope ( from ) {
		// TODO: shim for Object.create
		return Object.create( from || scope || null, { __procedure__: self } );
	}
	
	function parse ( obj, index, container ) {
		var statement, label, fn, array, keys, i, l, width;
		
		if ( Z.isFunction( obj ) ) {
			return obj;
		}
		
		else if ( Z.type( obj ) === 'string' ) {
			// Control statement: `return` | `break` | `continue`
			// `return` issues `stop()` on `this.__procedure__` and resolves the procedure deferral
			// `break` issues `stop()` on `this.__block__` and resolves the block deferral
			// `continue` issues `stop()` on `this.__block__` without resolving the block deferral
		}
		
		else if ( Z.isArray( obj ) ) {
			
			// Control block
			if ( Z.type( statement = obj[0] ) === 'string' ) {
				// TODO: labels ??
				return Procedure.statements[ statement ].apply( this, obj.slice(1) );
			}
			
			// Simple series or parallel literal: `[ ... ]` | `[[ ... ]]`
			else {
				fn = obj.length === 1 && Z.isArray( obj[0] ) ?
					( obj = obj[0], Procedure.structures.parallel ) :
					Procedure.structures.series;
				
				for ( array = [], i = 0, l = obj.length; i < l; i++ ) {
					array.push( parse.call( downscope( this ), obj[i], i, obj ) );
				}
				
				return fn.apply( this, array );
			}
		}
		
		// Multiplex literal: `{n:[ ... ]}`
		else if (
			Z.isPlainObject( obj )
			&& ( keys = Z.keys( obj ) ).length === 1
			&& Z.isNumber( width = Math.round( +keys[0] ) )
			&& Z.isArray( obj = obj[ width ] )
		) {
			for ( array = [], i = 0, l = obj.length; i < l; i++ ) {
				array.push( parse.call( downscope( this ), obj[i], i, obj ) );
			}
			return Procedure.structures.multiplex.call( this, width, array );
		}
	}
	
	Z.extend( this, {
		as: function ( context ) {
			deferral.as( context );
			return self;
		},
		given: function ( args ) {
			deferral.given( args );
			return self;
		},
		start: function () {
			var result = procedure.apply( self, arguments );
			
			function affirm () {
				return deferral.as( result ).given( arguments ).affirm();
			}
			function negate () {
				return deferral.as( result ).given( arguments ).negate();
			}
			
			Promise.resembles( result ) ?
				result.then( affirm, negate ) :
				( result ? affirm : negate ).apply( self, result );
			
			return self.promise();
		},
		promise: function () {
			return deferral.promise();
		}
	});
}

function ExecutionDeferral () {
	if ( !( this instanceof ExecutionDeferral ) ) { return new ExecutionDeferral; }
	Deferral.call( this, { ok: 'proceed', error: 'throw' } );
}
ExecutionDeferral.prototype = Deferral.prototype;

Z.extend( true, Procedure, {
	structures: {
		series: function () {
			var	pipeline = Pipeline( Z.slice.call( arguments ) ).as( this );
			return function () {
				return pipeline.given( arguments ).start().promise();
			};
		},
	
		parallel: function () {
			var	scope = this,
				promises = Z.slice.call( arguments );
			return function () {
				for ( var obj, i = 0, l = promises.length; i < l; i++ ) {
					obj = promises[i].apply( scope, arguments );
					if ( !( Z.isFunction( obj ) || Promise.resembles( obj ) ) ) {
						obj = Deferral.Nullary( scope, obj );
					}
					promises[i] = obj;
				}
				return Deferral.when( promises );
			};
		},
	
		multiplex: function ( width, operations ) {
			var multiplex = Multiplex( width, operations ).as( this );
			return function () {
				return multiplex.given( arguments ).start().promise();
			};
		},
	
		branch: function ( condition, potential ) {
			var	scope = this,
				execution = ( new ExecutionDeferral ).as( scope );
			
			return function () {
				
				// If `condition` is a function, treat it like a closure over the actual object of interest
				Z.isFunction( condition ) && ( condition = condition.apply( scope, arguments ) );
				
				return condition = (
					Promise.resembles( condition ) ? condition :
					Z.isArray( condition ) ? Procedure( condition, scope ).given( arguments ).start() :
					( new Deferral ).as( scope ).given( arguments )[ condition ? 'affirm' : 'negate' ]()
				)
					.promise()
					
					// After the condition is resolved, match its resolution with the corresponding value in
					// `potential`, evaluate that as a new Procedure, and use its result to resolve `execution`.
					.always( function () {
						var	resolution = condition.resolution().split('.'),
							i = 0, l = resolution.length, block;
						
						// Identify the entry within `potential` that corresponds to the resolution of
						// `condition`, and use that to create a procedural block.
						while ( i < l ) {
							block = potential[ resolution[ i++ ] ];
						}
						Z.isPlainObject( block ) && ( block = block[''] );
						block = Procedure( block, scope );
						
						// Arrange for the block to be executed once `condition` is resolved.
						condition.register( resolution, function () {
							return block
								.given( arguments )
								.start()
								.promise()
								.then( execution.proceed, execution.throw )
							;
						});
					});
			};
		},
	
		loop: function ( initialization, precondition, procedure, postcondition ) {
		
		},
	
		exception: function ( attempt, errorPotential ) {
		
		}
	},
	
	statements: {
		'if': function ( condition, potential ) {
			return Procedure.structures.branch.call( this, condition, potential );
		},
		'do': function () {
			var	argsIn = Z.slice.call( arguments ),
				argsOut = [ null, null, argsIn[0] ];
			argsIn[1] === 'while' && argsOut.push( argsIn[2] );
			return Procedure.structures.loop.apply( this, argsOut );
		},
		'while': function ( condition, procedure ) {
			return Procedure.structures.loop.call( this, null, condition, procedure );
		},
		'for': function ( expr, procedure ) {
			var	initialization = expr[0], condition = expr[1], iteration = expr[2];
			return Procedure.structures.loop.call( this, initialization, condition, [ procedure, iteration ] );
		},
		'try': function () {
			var	argsIn = Z.slice.call( arguments ),
				argsOut = [ argsIn[0] ];
			argsIn[1] === 'catch' && argsOut.push( argsIn[2] );
			return Procedure.structures.exception.apply( this, argsOut );
		}
	}
});


})();

