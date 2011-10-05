( Deferral.prototype = new Future ).constructor = Deferral;

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
		resolution = {},
		registerFn, resolveFn,
		promise;
	
	
	// Translates shorthand `potential` into the more verbosely-keyed standard format
	function format ( input ) {
		var key, value;
		for ( key in input ) if ( Z.hasOwn( input, key ) ) {
			value = input[ key ];
			input[ key ] =
				Z.type( value ) === 'string' ? { resolver: value } :
				Z.isPlainObject( value ) ? { substates: format( value ) } :
				Z.isArray( value ) ? { resolver: input[0], substates: format( input[1] ) } :
				{};
		}
		return input;
	}

	// Deeply constructs all registrar methods, along with any associated resolver methods
	function createMethods ( obj, path, states ) {
		var i, substate, subpath;
		for ( i in states ) if ( Z.hasOwn( states, i ) ) {
			substate = states[i];
			subpath = path ? path + '.' + substate : substate;
			
			obj[ substate ] = registerFn( subpath );
			substate.resolver && ( self[ substate.resolver ] = resolveFn( subpath ) );
			
			substate.substates && createMethods( obj[ substate ], subpath, substate.substates );
		}
	}
	
	Z.extend( this, {
		/**
		 * If called with no parameter, returns a copy of the `resolution` object, containing the name
		 * of the state to which the deferral has resolved, if any, and the bound context and arguments.
		 *
		 * If called with a `test` string, returns `true` if `test` matches the resolution state path,
		 * `false` if the resolution state is different from `test`, and `undefined` if the deferral is
		 * still unresolved.
		 */
		resolution: function ( test ) {
			return test != null ?
				test === resolution.state || ( Z.lookup( potential, test ) ? false : undefined ) :
				Z.extend( {}, resolution );
		},
		
		/**
		 * Returns whether or not the deferral has resolved, or whether it was resolved by the specified
		 * `test` resolver method.
		 */
		did: function ( test ) {
			var state = resolution.state;
			return test ? !!state && test === Z.lookup( potential, state ) : !!state;
		},
		
		/**
		 * Caches and returns a promise to this deferral.
		 */
		promise: function () {
			return promise || ( promise = new Promise( this ) );
		}
	});
	
	/*
	 * Handle the special case of a nullary deferral, which behaves like a "pre-resolved" unary deferral,
	 * where there are no potentials, no queues, and no registrar or resolver methods, but functions added
	 * through `then`, `always`, etc., will simply be executed immediately. No `as()` or `given()` methods
	 * are available either; instead the resolution context and resolution arguments are provided in the
	 * constructor call, after the `null` first argument, at positions 1 and 2, respectively.
	 */
	if ( potential === null ) {
		resolution.state = true;
		this.potential = this.futures = Z.noop;
		this.as = this.given = this.empty = Z.getThis;
		this.then = Deferral.privileged.invoke( this, null )
			( resolution.context = fn, resolution.arguments = args );
		this.always = function () { return this.then( Z.slice.call( arguments ) ); };
	}
	
	/*
	 * Normal (n > 0)-ary deferral, initialized to the "unresolved" state.
	 */
	else {
		Z.extend( this, {
			/**
			 * Returns a copy of the deferral's `potential` map as supplied to its constructor.
			 */
			potential: function () {
				return Z.extend( {}, potential );
			},
			
			/**
			 * Returns an Array containing the names of the resolution states defined **in the
			 * first level only** of this deferral's potential map.
			 */
			futures: function () {
				return Z.keys( potential );
			},
			
			as: function ( context ) {
				resolution.context = context;
				return this;
			},
			
			given: function ( args ) {
				resolution.arguments = args;
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
		
		registerFn = Deferral.privileged.register( this, callbacks );
		resolveFn = Deferral.privileged.resolve( this, callbacks, resolution );
		createMethods( self, '', format( potential ) );
		registerFn = resolveFn = null;
		
		fn && Z.isFunction( fn ) && fn.apply( this, args );
	}
}
Z.extend( true, Deferral, {
	privileged: {
		/**
		 * Produces a function that adds callbacks to a queue associated with the specified resolved
		 * substate.
		 */
		register: function ( self, callbacks ) {
			function selfFnFn () { return function () { return self; }; }
			
			return function ( state ) {
				var	queue = Z.lookup( callbacks, state ),
					registrar = Z.lookup( self.register, state );
				
				return queue ?
					function ( fn ) {
						Z.isFunction( fn ) && queue.push( fn ) ||
							registrar && Z.isArray( fn ) && Z.forEach( fn, registrar );
						return self;
					} :
					selfFnFn();
			};
		},
		
		/**
		 * Produces a function that will resolve the deferral, which will immediately and irreversibly
		 * transition its resolution state from "unresolved" to one of its resolved substates.
		 */
		resolve: function ( self, callbacks, resolution ) {
			var	invokeFn = this.invoke( self, callbacks ),
				invokeAllFn = this.invokeAll( self, callbacks ),
				potential = self.potential();
			
			function selfFnFn () { return function () { return self; }; }
			
			return function ( state ) {
				if ( !Z.lookup( potential, state ) ) {
					throw new ReferenceError( "Bad state path" );
				}
				
				var path = ( resolution.state = state ).split('.');
				
				/*
				 * The deferral has transitioned to a 'resolved' substate (e.g. affirmed, negated, etc.),
				 * so the behavior of its registrar and resolver methods must be redefined to reflect this.
				 * A closure preserves the resolution state and its `context` and `args`; subsequent
				 * callback registrations addressed to `resolution` and its superstates instead cause
				 * the function to be called immediately with the saved `context` and `args`, while
				 * subsequent callback registrations for any other states are rendered invalid, and will
				 * be discarded.
				 */
				return function () {
					var	context = resolution.context,
						args = arguments.length ?
								( resolution.arguments = Z.slice.call( arguments ) ) :
								resolution.arguments;
					
					/*
					 * After the resolution state transition, only registrar methods along the path of
					 * `state` will respond to callback registrations. These methods are changed to a
					 * copy of the invoke function, and all others are changed to a return-self
					 * function.
					 */
					Z.extend( self, self.register = ( function () {
						var	result, cursor = result = invokeFnFn(), i = 0, l = path.length, name;
						function invokeFnFn () { return invokeFn( context, args ); }
						function map ( from, to ) {
							for ( var key in from ) if ( Z.hasOwn( from, key ) ) {
								Z.hasOwn( to, key ) || ( to[ key ] = selfFnFn() );
								map( from[ key ], to[ key ] );
							}
							return to;
						}
						
						while ( i < l ) {
							( cursor = cursor[ name = path[ i++ ] ] )[ name ] = invokeFnFn();
						}
						return map( self.register, result );
					})() );
					
					/*
					 * Since the resolution state transition is by definition irreversible, there is no
					 * longer any use for the resolver methods, so these are changed to a return-self
					 * function.
					 */
					Z.extend( self, self.resolve = ( function () {
						var	result = Z.isFunction( self.resolve ) ? selfFnFn() : {};
						function map ( from, to ) {
							var key, value;
							for ( key in from ) if ( Z.hasOwn( from, key ) ) {
								map( value = from[ key ], to[ key ] = Z.isFunction( value ) ? selfFnFn() : {} );
							}
							return to;
						}
						return map( self.resolve, result );
					})() );
					
					/*
					 * With the deferral's behavior alterations complete, we can now invoke all of the
					 * previously queued callbacks along the path of `state`, and finally dispense with
					 * the callback queues.
					 */
					( function () {
						var invokeAll = invokeAllFn( context, args ), i = 0, l = path.length, cursor = callbacks;
						do invokeAll( Z.hasOwn( cursor, '' ) ? cursor[''] : cursor )
							while ( cursor = cursor[ path[i] ], ++i < l );
						callbacks = null;
					})();
					
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
