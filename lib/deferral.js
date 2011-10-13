/**
 * `Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.
 * 
 * @param Object potential : Hashmap whose entries represent the set of resolved substates for the deferral;
 * 		keys specify a name for the substate's callback queue, and values specify a name for the
 * 		resolution method used to transition to that substate and execute its associated callbacks.
 * @param Function fn : A function that will be executed immediately in the context of the deferral.
 * @param Array args : Array of arguments to be passed to `fn`.
 */
Z.inherit( Deferral, Future );

function Deferral ( potential, fn, args ) {
	if ( !( this instanceof Deferral ) ) {
		return new Deferral( potential, fn, args );
	}
	if ( potential === undefined || Z.isFunction( potential ) ) {
		return new Deferral.Binary( potential, fn );
	}
	
	
	var	self = this,
		
		// Root element of the state hierarchy
		rootState = Z.getPrototypeOf( this ).state,
		
		// Arranges callback queues in a tree structure analogous with the state hierarchy
		callbacks = new CallbackQueueTree( rootState ),
		
		// Map keying names of resolver methods to their associated resolution states
		resolvers = {},
		
		// Container for terms of the deferral's resolution status
		resolution = {
			state: rootState.substate( 'unresolved' ),
			context: undefined,
			arguments: undefined
		},
		
		// Deprecated
		futures,
		
		// Memoized promise instance
		promise;
	
	// 
	potential instanceof Potential ||
		( potential = new Potential( potential ) );
	
	Z.extend( this, {
		/**
		 * 
		 */
		potential: function () { return potential; },
		
		resolvers: Z.create( this.resolvers ),
		
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
				test === resolution.state.path() || ( Z.lookup( potential, test ) ? false : undefined ) :
				Z.extend( {}, resolution );
		},
		
		/**
		 * Returns whether or not the deferral has resolved, or whether it was resolved **to or beyond**
		 * the state associated with the resolver method named `test`.
		 */
		did: function ( resolverName ) {
			var	state = resolution.state,
				test = resolvers[ resolverName ];
			
			return resolverName ?
				( test ) === state || test.isSuperstateOf( state )
				:
				state instanceof ResolvedState &&
					( state === potential || potential.isSuperstateOf( state ) );
		},
		
		/**
		 * Caches and returns a promise to this deferral.
		 */
		promise: function ( uncached ) {
			return uncached ?
				new Promise( this ) :
				promise || ( promise = new Promise( this ) );
		},
		
		/**
		 * Returns a copy of the deferral's formatted `potential` map.
		 */
		potential: function () {
			return Z.extend( {}, potential );
		},
		
		/**
		 * Returns an Array containing the paths of the resolution states defined in
		 * this deferral's potential map.
		 */
		futures: function () {
			function iterate ( substates ) {
				var key, substate;
				for ( key in substates ) {
					substate = substates[ key ];
					futures.push( substate.path() );
					substate.substates && iterate( substate.substates );
				}
				return futures;
			}
			return futures || ( futures = [], iterate( this.substates ) );
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
			callbacks.empty();
			return this;
		}
	});
	
	Deferral.createMethods(
		this,
		Deferral.privileged.register( this, callbacks ),
		Deferral.privileged.resolve( this, callbacks, resolution ),
		potential
	);
	
	fn && Z.isFunction( fn ) && fn.apply( this, args );
}
Z.extend( true, Deferral, {
	privileged: {
		/**
		 * Outer closure for the registrar method factory.
		 */
		register: function ( self, callbacks ) {
			var potential = self.potential();
			
			/**
			 * Registrar method factory: produces a function that will add callbacks to a queue
			 * associated with the specified state.
			 */
			return function ( state ) {
				Z.type( state ) === 'string' && ( state = potential.substate( state ) );
				if ( !( state && potential.isSuperstateOf( state ) ) ) {
					throw new ReferenceError( "Bad state reference" );
				}
				
				var queue = callbacks.get( state );
				
				function register ( fn ) {
					Z.isFunction( fn ) ?
						queue.push( fn ) :
						Z.isArray( fn ) && Z.forEach( fn, register );
					return self;
				}
				
				return register;
			};
		},
		
		/**
		 * Outer closure for the resolver method factory.
		 */
		resolve: function ( self, callbacks, resolution ) {
			var	invokeFn = this.invoke( self, callbacks ),
				invokeAllFn = this.invokeAll( self, callbacks ),
				potential = self.potential();
			
			/**
			 * Resolver method factory: produces a function that will resolve the deferral to the
			 * targeted state and alter the deferral's behavior accordingly.
			 */
			return function ( state ) {
				var target = state instanceof ResolvedState ? state : Z.lookup( potential, state );
				
				if ( !target || !potential.isSuperstateOf( target ) ) {
					throw new ReferenceError( "Bad state path" );
				}
				
				/*
				 * Since the deferral has transitioned to a 'resolved' substate (e.g. affirmed, negated,
				 * etc.), the behavior of its registrar and resolver methods must be redefined.
				 * 
				 * Resolution state, `context` and `args` are preserved in the closure; henceforth,
				 * callback registrations addressed to the selected state or its superstates cause
				 * the callback to be invoked immediately with the saved `context` and `args`, while
				 * subsequent callback registrations to any other states are rendered invalid, and will
				 * be ignored.
				 */
				return function () {
					var	context = resolution.context,
						args = arguments.length ?
								( resolution.arguments = Z.slice.call( arguments ) ) :
								resolution.arguments;
					
					state = target;
					
					/*
					 * All of the deferral's nested registrar methods must be redefined such that
					 * only those related to the selected `state` will respond to further callback
					 * registrations. Those methods are changed to a copy of the invoke function,
					 * and all others are changed to a return-self function.
					 */
					Z.extend( self, self.resolved = ( function () {
						var	result, cursor = result = invokeFnFn(),
							derivation = state.derivation(),
							i = 0, l = derivation.length,
							name;
						
						function invokeFnFn () {
							return invokeFn( context, args );
						}
						function map ( from, to ) {
							for ( var key in from ) if ( Z.hasOwn( from, key ) ) {
								// If something already exists here, it's an invoke function, so keep it
								Z.hasOwn( to, key ) || ( to[ key ] = Z.thunk( self ) );
								map( from[ key ], to[ key ] );
							}
							return to;
						}
						
						/*
						 * First create the functional branches of the function tree, i.e. those that
						 * will be responsive to any subsequent callback registrations ...
						 */
						while ( i < l ) {
							( cursor = cursor[ name = derivation[ i++ ].name() ] )[ name ] = invokeFnFn();
						}
						
						/**
						 * ... then fill out the remaining functions with return-self (the functions
						 * just created will be skipped over and not overwritten).
						 */
						return map( self.resolved, result );
					})() );
					
					/*
					 * Since the resolution state transition is by definition irreversible, there is no
					 * longer any use for the resolver methods, so these are changed to a return-self
					 * function.
					 */
					Z.extend( self, self.resolve = ( function () {
						var	result = Z.isFunction( self.resolve ) ? Z.thunk( self ) : {};
						function map ( from, to ) {
							var key, value;
							for ( key in from ) if ( Z.hasOwn( from, key ) ) {
								map( value = from[ key ], to[ key ] =
										Z.isFunction( value ) ? Z.thunk( self ) : {}
									);
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
						var	invokeAll = invokeAllFn( context, args ),
							i = 0, l = path.length,
							cursor = callbacks;
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
		invoke: function ( self, callbacks ) {
			var invokeAllFn = this.invokeAll( self, callbacks );
			return function ( context, args ) {
				var invokeAll = invokeAllFn( context, args );
				return function ( fn ) {
					try {
						Z.isFunction( fn ) ? fn.apply( context || self, args ) :
						Z.isArray( fn ) && invokeAll( fn );
					} catch ( nothing ) {}
					return self;
				};
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( self, callbacks ) {
			var invokeFn = this.invoke( self, callbacks );
			return function ( context, args ) {
				var invoke = invokeFn( context, args );
				return function ( fns ) {
					for ( var i = 0, l = fns.length; i < l; i++ ) {
						invoke( fns[i] );
					}
					return self;
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
				if ( promise instanceof Future ) {
					
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
	},
	
	/**
	 * Deeply constructs all registrar methods, along with any associated resolver methods, by walking
	 * the resolution potential tree.
	 */
	createMethods: function ( subject, registerFn, resolverFn, states ) {
		var i, state, name, path, resolver;
		for ( i in states ) if ( Z.hasOwn( states, i ) ) {
			state = states[i];
			name = state.name(), path = state.path();
			
			subject[ name ] = registerFn( path );
			( resolver = state.resolver ) && (
				deferral.resolvers[ resolver ] = state,
				deferral[ resolver ] = resolveFn( path )
			);
			
			state.substates &&
				this.createMethods( subject[ name ], registerFn, resolverFn, state.substates );
		}
	}
});

Deferral.prototype.state = State({
	unresolved: {
		pending: {}
	},
	resolved: Potential({
		yes: 'affirm',
		no: 'negate'
	})
});

Deferral.when = Deferral.prototype.when;

//////////////

/*
 * A nullary deferral can be thought of as an “already resolved” deferral: there is no potential,
 * no callback queues, and no registrar or resolver methods; functions added via `then`, `always`,
 * etc., will simply be executed immediately. No `as()` or `given()` methods are available either;
 * instead, the resolution context and resolution arguments must be provided as arguments of the
 * constructor.
 */
Deferral.Nullary = Z.inherit( NullaryDeferral, Deferral, {
	state: State({ resolved: {} })
});
function NullaryDeferral ( as, given ) {
	if ( !( this instanceof NullaryDeferral ) ) {
		return new NullaryDeferral( as, given );
	}
	
	var	resolution = {
			state: Z.getPrototypeOf( this ).defaultState,
			as: as,
			given: given
		};
	
	Z.extend( this, {
		resolution: ,
		did: ,
		promise: ,
		potential: Z.noop,
		as: Z.getThis,
		given: Z.getThis,
		empty: Z.getThis,
		then: Deferral.privileged.invoke( this, null )( as, given )
	});
}
Z.extend( NullaryDeferral.prototype, {
	always: function () {
		return this.then( Z.slice.call( arguments ) );
	}
});

//////////////

Deferral.Unary = Z.inherit( UnaryDeferral, Deferral, {
	defaultState: State({
		unresolved: {
			pending: {}
		},
		resolved: Potential()
	})
});
function UnaryDeferral ( fn, args ) {
	if ( !( this instanceof UnaryDeferral ) ) { return new UnaryDeferral( fn, args ); }
	Deferral.call( this, { done: 'resolve' }, fn, args );
}

//////////////

Deferral.Binary = Z.inherit( BinaryDeferral, Deferral, {
	defaultState: State({
		unresolved: {
			pending: {}
		},
		resolved: Potential({
			yes: 'affirm',
			no: 'negate'
		})
	})
});
function BinaryDeferral ( fn, args ) {
	if ( !( this instanceof BinaryDeferral ) ) { return new BinaryDeferral( fn, args ); }
	Deferral.call( this, { yes: 'affirm', no: 'negate' }, fn, args );
}
