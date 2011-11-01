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
		args = fn, fn = potential, potential = undefined;
	}
	if ( potential ) {
		this.state = potential instanceof Potential ?
			potential.root() :
			State({
				unresolved: { pending: null },
				resolved: potential = Potential( potential )
			});
	} else {
		potential = this.state.substate( 'resolved' );
	}
	
	
	var	self = this,
		
		// Root element of the state hierarchy
		root = this.state,
		
		// Arrangement of callback queues in a tree structure analogous with the state hierarchy
		callbacks = new CallbackQueueTree( root ),
		
		// Container for terms of the deferral's resolution status
		resolution = {
			// The deferral's current state
			state: root.substate( 'unresolved' ),
			
			// The context in which all queued callback functions will be called
			context: undefined,
			
			// The arguments that will be supplied to all queued callbacks
			arguments: undefined
		},
		
		// Privileged method store
		privileged = Deferral.privileged,
		
		// Memoized registrar method factory
		registrarFactory,
		
		// Memoized resolver method factory
		resolverFactory,
		
		// Memoized join method factory
		joinFactory,
		
		// Maps names of resolver methods to their associated resolution states
		resolvers = {},
		
		// Memoized promise instance
		promise;
	

	Z.extend( this, {
		/**
		 * Returns the deferral's topmost 'resolved' state.
		 */
		potential: function () {
			return potential;
		},
		
		/**
		 * Returns a list of the deferral's resolver method names.
		 */
		resolvers: function () {
			return Z.keys( resolvers );
		},
		
		/**
		 * Registers a callback, or an array of callbacks, to be invoked should the deferral later
		 * be resolved to the specified `state`, or a substate thereof.
		 * 
		 * @param Boolean useBubble (optional) : When a deferral is resolved, it does so by
		 * transitioning into a particular resolution state; this state may be a substate of a
		 * superstate, which itself may also be a substate of another superstate, and so on.
		 * Callback invocation begins with a "capture" phase, where callbacks registered to the
		 * superstates are invoked first, starting with the top-level `ResolvedState` (referenced
		 * by `potential`), and ending at the specific targeted resolution state; following this
		 * is the "bubble" phase, which retraces the derivation path in the opposite direction.
		 * **Callbacks registered with `useBubble` set to `true` will be invoked during the latter
		 * bubble phase; otherwise, they will be invoked during the initial capture phase.**
		 */
		registerTo: function ( state, fn, useBubble ) {
			var potential = this.potential();
			
			Z.isString( state ) &&
				( state = potential.substate( state ) || potential.superstate().substate( state ) );
			
			return state && potential.isOrIsSuperstateOf( state ) ?
				registrarFactory( state ).call( this, fn, useBubble ) :
				this;
		},
		
		/**
		 * 
		 */
		resolveTo: function ( state ) {
			Z.isString( state ) &&
				( state = potential.substate( state ) || potential.superstate().substate( state ) );
			return state && potential.isOrIsSuperstateOf( state ) ?
				resolverFactory( state ).apply( this, Z.slice.call( arguments, 1 ) ) :
				this;
		},
		
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
				Z.extend( 'deep', {}, resolution );
		},
		
		/**
		 * Returns whether or not the deferral has resolved, or whether it was resolved **to or beyond**
		 * the state associated with the resolver method named `test`.
		 */
		did: function ( name ) {
			var state = resolution.state;
				test = name ?
					resolvers[ name ] ||
						ResolvedState.lookup( potential, name ) ||
						ResolvedState.lookup( potential.superstate(), name ) :
					potential;
			
			return state instanceof ResolvedState &&
				test ?
					test.isOrIsSuperstateOf( state ) :
					undefined;
		},
		
		/**
		 * Caches and returns a promise to this deferral.
		 */
		promise: function ( uncached ) {
			return uncached ?
				new Promise( this ) :
				promise || ( promise = new Promise( this ) );
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
	
	// Recursively generate registrar and resolver methods as needed
	registrarFactory = privileged.register( this, callbacks );
	resolverFactory = privileged.resolve( this, callbacks, resolution );
	Deferral.createMethods( this, { resolved: potential }, {
		deferral: this,
		resolvers: resolvers,
		registrarFactory: registrarFactory,
		resolverFactory: resolverFactory
	});
	Z.extend( 'own', this, this.resolved );
	
	// Generate context-bound `join` methods
	// TODO (?): move these per-instance join methods to BinaryDeferral constructor, since that's the only place that uses them
	joinFactory = privileged.join( this );
	Z.extend( this, {
		when: Z.extend( joinFactory( 'when all' ), {
			all: joinFactory( 'when all' ),
			any: joinFactory( 'when any' ),
			none: joinFactory( 'when none' )
		}),
		unless: Z.extend( joinFactory( 'unless all' ), {
			all: joinFactory( 'unless all' ),
			any: joinFactory( 'unless any' ),
			none: joinFactory( 'unless none' )
		})
	});
	
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
				if ( !( state && ( potential.isOrIsSuperstateOf( state ) ) ) ) {
					throw new ReferenceError( "Bad state reference" );
				}
				
				// TODO: `useBubble` queue lookup/memo should be more efficient when `fn` is an array
				function registrar ( fn, useBubble ) {
					var queue = callbacks.get( state, useBubble ? 'bubble' : 'capture' );
					Z.isFunction( fn ) ?
						queue.push( fn ) :
						Z.isArray( fn ) && Z.forEach( fn, function ( fn_ ) {
							return registrar( fn_, useBubble );
						});
					return self;
				}
				
				return registrar;
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
				state instanceof ResolvedState ||
					( state = potential.substate( state ) || potential.root().substate( state ) );
				
				if ( !( state && potential.isSuperstateOf( state ) ) ) {
					throw new ReferenceError( "Bad state path" );
				}
				
				var derivation = state.derivation( potential.superstate() );
				
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
				function resolver () {
					var	selfFn = Z.thunk( self ),
						context = resolution.context,
						args = arguments.length ?
								( resolution.arguments = Z.slice.call( arguments ) ) :
								resolution.arguments;
					
					resolution.state = state;
					
					/*
					 * First modify the behavior of the explicit registrar and resolver methods.
					 * `registerTo` will now invoke callbacks immediately if they are registered
					 * to the resolution state or one of its superstates, or silently return the
					 * deferral if registered to any other state; `resolveTo` will now simply
					 * return the deferral, since the resolution state transition is by definition
					 * irreversible.
					 */
					Z.extend( self, {
						registerTo: function ( state_ ) {
							Z.isString( state_ ) && ( state_ = potential.substate( state_ ) );
							return state_ instanceof State &&
								state_.isOrIsSuperstateOf( resolution.state ) ?
									invokeFn( context, args )
										.apply( self, Z.slice.call( arguments, 1 ) )
									:
									self;
						},
						resolveTo: selfFn
					});
					
					/*
					 * Next, the deferral's nested registrar methods must be redefined such that
					 * only those related to the selected `state` will respond to further callback
					 * registrations by immediately invoking the specified callback(s). Those
					 * methods are changed to a copy of the invoke function, and all others are
					 * changed to a return-self function.
					 */
					Z.extend( self, self.resolved = ( function () {
						function invokeFnFn () {
							return invokeFn( context, args );
						}
						function map ( source, target ) {
							for ( var key in source ) if ( Z.hasOwn.call( source, key ) ) {
								// If something already exists here, it's an invoke function, so keep it ...
								Z.hasOwn.call( target, key ) ||
									( target[ key ] = Z.thunk( self ) );
								map( source[ key ], target[ key ] );
							}
							return target;
						}
						
						var	result, cursor = result = invokeFnFn(),
							i = 1, l = derivation.length;
						
						/*
						 * First create the functional branches of the function tree, i.e. those that
						 * will be responsive to any subsequent callback registrations ...
						 */
						while ( i < l ) {
							cursor = cursor[ derivation[ i++ ].name() ] = invokeFnFn();
						}
						
						/**
						 * ... then fill out the remaining functions with return-self (the functions
						 * just created will be skipped over and not overwritten).
						 */
						return map( self.resolved, result );
					})() );
					
					/*
					 * Just as with `resolveTo`, there is no longer any use for the named resolver
					 * methods, so these are also changed to the return-self function.
					 */
					( function () {
						var	resolvers = self.resolvers(),
							i = 0, l = resolvers.length;
						while ( i < l ) { self[ resolvers[ i++ ] ] = selfFn; }
					})();
					
					/*
					 * With the deferral's behavior alterations complete, we can now invoke all of the
					 * previously queued callbacks along the path of `state`, first in a "capture"
					 * phase from root to target, then in a "bubble" phase from target to root ...
					 */
					( function () {
						var	i = 0, l = derivation.length,
							queue,
							invokeAll = invokeAllFn( context, args );
						while ( i < l ) {
							( queue = callbacks.get( derivation[ i++ ], 'readonly capture' ) ) &&
								invokeAll( queue );
						}
						while ( i ) {
							( queue = callbacks.get( derivation[ --i ], 'readonly bubble' ) ) &&
								invokeAll( queue );
						}
					})();
					
					/* ... and then finally dispense with the callback queues. */
					callbacks = null;
					
					return self;
				}
				
				return resolver;
			};
		},
		
		/**
		 * Produces a function that invokes a queued callback. In addition, when the deferral is
		 * resolved, the function returned here will become the registrar method (e.g., 'yes' | 'no')
		 * for the state (and its superstates) to which the deferral has resolved, such that any
		 * subsequent registration of a callback will result in that callback being invoked immediately.
		 */
		invoke: function ( self, callbacks ) {
			var privileged = this;
			return function ( context, args ) {
				function invoke ( fn ) {
					try {
						Z.isFunction( fn ) ? fn.apply( context || self, args ) :
						Z.isArray( fn ) && privileged.invokeAll( self, callbacks )( context, args )( fn );
					} catch ( nothing ) {}
					return self;
				}
				return invoke;
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( self, callbacks ) {
			var privileged = this;
			return function ( context, args ) {
				var invoke = privileged.invoke( self, callbacks )( context, args );
				function invokeAll ( fns ) {
					for ( var i = 0, l = fns ? fns.length : 0; i < l; i++ ) {
						invoke( fns[i] );
					}
					return self;
				}
				return invokeAll;
			};
		},
		
		join: function ( deferral ) {
			return function ( flags ) {
				return function () {
					var args = Z.slice.call( arguments );
					args.unshift( flags );
					return ( deferral || Deferral.prototype ).join.apply( deferral, args );
				};
			};
		}
	},
	
	prototype: {
		state: State({
			unresolved: {
				pending: {}
			},
			resolved: Potential({
				yes: 'affirm',
				no: 'negate'
			})
		}),
		
		/**
		 * Binds together the fate of multiple Futures by testing the eventual resolution of each
		 * against certain conditions.
		 * 
		 * Returns a `Promise` to a master `BinaryDeferral` that will resolve to either `yes` or
		 * `no` as soon as it can be determined that the specified set of Futures collectively will
		 * or will not satisfy the join conditions.
		 * 
		 * deferral.join( [ String flags, ] Future future1, ... [ State|String resolutionState1, ... ] [ Function|Array callback1, ... ] )
		 * 
		 * `flags` is an optional attribute list provided as a space-delimited string. Values include:
		 *   - { 'when' | 'unless' } : Specifies whether to resolve the master deferral affirmatively
		 *         (`when`) or negatively (`unless`) if the set of futures eventually match any of
		 *         the specified resolution states. If omitted, defaults to `when`.
		 *   - { 'all' | 'any' | 'none' } : Specifies whether to resolve the master deferral once it
		 *         can be determined that `all`, `any` one, or `none` of the joined futures will
		 *         match the specified resolution states. If omitted, defaults to `all`.
		 * 
		 * `resolutionState` arguments specify one or more State objects to which the provided
		 * futures may resolve in order to cause the master deferral to resolve affirmatively
		 * (or negatively, if so specified with the `unless` flag). If provided as a String, a
		 * `resolutionState` argument is interpreted as a state path evaluated against each
		 * future's root state. If no `resolutionState` arguments are provided, the targeted
		 * state is assumed to be the first resolved substate for each future.
		 * 
		 * `callback` arguments specify functions to be called once the master deferral resolves
		 * affirmatively, equivalent to a chained call of `.join( ... ).yes( callbacks )`.
		 */
		join: function () {
			var	master = this instanceof BinaryDeferral && !this.did() ?
					this :
					new BinaryDeferral,
				args = Z.slice.call( arguments ),
				arg = args.shift(),
				futures = [],
				states = [],
				callbacks = [],
				resolvedFutures = [],
				flags, future, direction, potential, state, registrar,
				element,
				affirmative, negative,
				i, l, j, sl;
			
			/**
			 * Based on the type of join operation this is, as specified by `flags`, this function
			 * dictates how the resolution of a constituent `future_` will relate to the resolution
			 * of the master BinaryDeferral.
			 */
			function direct ( future_ ) {
				var resolved = false,
					unless = flags.unless,
					when = flags.when || !unless,
					none = flags.none,
					any = flags.any,
					all = flags.all || !( none || any ),
					result;
				
				function affirmImmediately () {
					resolved || ( resolved = true, master.affirm( future_ ) );
				}
				function affirmLater () {
					resolved ||
						( resolved = true ) &&
						resolvedFutures.push( future_ ) === futures.length &&
						master.given( resolvedFutures ).affirm();
				}
				function negateImmediately () {
					resolved || ( resolved = true, master.negate( future_ ) );
				}
				function negateLater () {
					resolved ||
						( resolved = true ) &&
						resolvedFutures.push( future_ ) === futures.length &&
						master.given( resolvedFutures ).negate();
				}
				
				result =
					when && (
						all && [ affirmLater, negateImmediately ] ||
						any && [ affirmImmediately, negateLater ] ||
						none && [ negateImmediately, affirmLater ]
					) ||
					unless && (
						all && [ negateLater, affirmImmediately ] ||
						any && [ negateImmediately, affirmLater ] ||
						none && [ affirmImmediately, negateLater ]
					);
				
				return { affirmative: result[0], negative: result[1] };
			}
			
			// FIXME(?): The section below is bloated, perhaps overly generous as to argument flexibility
			
			/*
			 * Parse out the flags and relevant collections from the argument list
			 */
			if ( Z.isString( arg ) ) {
				flags = Z.splitToHash( arg );
				arg = args.shift();
			} else {
				flags = {};
			}
			
			// For `futures`, accept an array of Futures, or a contiguous series of Future
			// arguments
			if ( arg && Z.isArray( arg ) ) {
				arg = Z.flatten( arg );
				for ( i = 0, l = arg.length; i < l; i++ ) {
					Future.resembles( element = arg[i] ) && futures.push( element );
				}
				arg = args.shift();
			} else {
				while ( arg && Future.resembles( arg ) ) {
					futures.push( arg ), arg = args.shift();
				}
			}
			
			// For `states`, accept an array containing any combination of ResolvedStates,
			// Booleans, or Strings, or a contiguous series of arguments of those types
			if ( arg && Z.isArray( arg ) ) {
				arg = Z.flatten( arg );
				for ( i = 0, l = arg.length; i < l; i++ ) {
					( ( element = arg[i] ) instanceof ResolvedState ||
						Z.isBoolean( element ) ||
						Z.isString( element )
					) && states.push( element );
				}
				arg = args.shift();
			} else {
				while ( arg &&
					( arg instanceof ResolvedState || Z.isBoolean( arg ) || Z.isString( arg ) )
				){
					states.push( arg ), arg = args.shift();
				}
			}
			
			// For `callbacks`, accept an array of Functions, or a contiguous series of
			// Function arguments
			if ( arg && Z.isArray( arg ) ) {
				arg = Z.flatten( arg );
				for ( i = 0, l = arg.length; i < l; i++ ) {
					Z.isFunction( element = arg[i] ) && callbacks.push( element );
				}
				arg = args.shift();
			} else {
				while ( arg && Z.isFunction( arg ) ) {
					callbacks.push( arg ), arg = args.shift();
				}
			}
			
			/*
			 * Create and register callbacks that bind each future's outcome to the master deferral
			 */
			for ( i = 0, l = futures.length; i < l; i++ ) {
				future = futures[i];
				potential = future.potential();
				substateList = potential.substateList();
				direction = direct( future );
				affirmative = direction.affirmative, negative = direction.negative;
				
				if ( future instanceof Future ) {
					/*
					 * If this future resolves to any of the specified states, this will accordingly
					 * affect the master deferral in the manner ascribed to an affirmative result ...
					 */
					for ( j = 0, sl = states.length || states.push( true ); j < sl; j++ ) {
						state = states[j];
						Z.isBoolean( state ) && (
							state = substateList.length ?
								substateList[ state ? 0 : substateList.length - 1 ] :
								potential
						);
						future.registerTo( state, affirmative );
					}
				
					/*
					 * ... or, if this future resolves to a state that was *not* specified, this will
					 * conversely affect the master deferral as directed for a negative result.
					 */
					future.registerTo( potential, negative, true );
				}
				
				/*
				 * For foreign promise-like objects, there is no explict concept of variadic state,
				 * so just coerce the first listed state to a boolean, and use that to determine
				 * how this `future` will affect the master deferral.
				 */
				else {
					states.length && states[0] in Z.splitToHash([ 'no resolved.no negate false' ]) ?
						future.then( negative, affirmative ) :
						future.then( affirmative, negative );
				}
			}
			
			return master.promise();
		}
	},
	
	/**
	 * Walks the resolution potential tree, deeply constructing all registrar methods and any
	 * associated resolver methods.
	 */
	createMethods: function ( subject, states, delegate ) {
		var key,
			state, stateName, statePath,
			resolverName;
		
		for ( key in states ) if ( Z.hasOwn.call( states, key ) ) {
			state = states[ key ];
			stateName = state.name(), statePath = state.path();
			
			subject[ stateName ] = delegate.registrarFactory( state );
			( resolverName = state.resolverName() ) && (
				delegate.resolvers[ resolverName ] = state,
				delegate.deferral[ resolverName ] = delegate.resolverFactory( statePath )
			);
			
			state.substates &&
				this.createMethods( subject[ stateName ], state.substates, delegate );
		}
	},
	
	/**
	 * Returns an outer deferral that wraps an inner `future` object. Useful for coercing foreign
	 * promise implementations to a `Deferral` type.
	 */
	cast: function ( future ) {
		if ( !Future.resembles( future ) ) {
			throw new TypeError;
		}
		
		var	deferral = new ( this === Deferral || this.prototype instanceof Deferral ?
				this : Deferral ),
			potential = deferral.potential(),
			substates = potential.substates,
			substateNames = Z.keys( substates ),
			length = substateNames.length,
			affirmativeState = substates && length && substates[ substateNames[0] ] ||
				potential,
			negativeState = substates && length && substates[ substateNames[ length - 1 ] ] ||
				affirmativeState;
		
		function affirm () {
			deferral.as( this ).given( arguments ).resolveTo( affirmativeState );
		}
		function negate () {
			deferral.as( this ).given( arguments ).resolveTo( negativeState );
		}
		
		future.then( affirm, negate );
		
		return deferral;
	}
});

/*
 * Add `join`, `when` and `unless` as static members
 */
( function () {
	var join;
	
	Deferral.join = Deferral.prototype.join;
	
	join = Deferral.privileged.join( null );
	Z.extend( Deferral, {
		when: Z.extend( join( 'when all' ), {
			all: join( 'when all' ),
			any: join( 'when any' ),
			none: join( 'when none' )
		}),
		unless: Z.extend( join( 'unless all' ), {
			all: join( 'unless all' ),
			any: join( 'unless any' ),
			none: join( 'unless none' )
		})
	});
})();



//////////////

/*
 * A nullary deferral can be thought of as an “already resolved” deferral: there is no potential,
 * no callback queues, and no registrar or resolver methods; functions added via `then`, `always`,
 * etc., will simply be executed immediately. No `as()` or `given()` methods are available either;
 * instead, the resolution context and resolution arguments must be provided as arguments of the
 * constructor.
 */
Deferral.Nullary = Z.inherit( NullaryDeferral, Deferral, {
	state: State({ resolved: Potential() })
});
function NullaryDeferral ( as, given ) {
	if ( !( this instanceof NullaryDeferral ) ) {
		return new NullaryDeferral( as, given );
	}
	
	var	resolution = {
			state: this.state.substate( 'resolved' ),
			context: as,
			arguments: given
		},
		promise,
		invoke = Deferral.privileged.invoke( this, null )( as, given );
	
	Z.extend( this, {
		potential: function () { return resolution.state; },
		registerTo: function ( state, fn ) { return invoke( fn ); },
		resolveTo: Z.getThis,
		resolution: function () { return Z.extend( {}, resolution ); },
		did: function () { return true; },
		promise: function () { return promise || ( promise = new Promise( this ) ); },
		as: Z.getThis,
		given: Z.getThis,
		empty: Z.getThis,
		then: invoke
	});
}
Z.extend( NullaryDeferral.prototype, {
	always: function () {
		return this.then( Z.slice.call( arguments ) );
	}
});



//////////////

Deferral.Unary = Z.inherit( UnaryDeferral, Deferral, {
	state: State({
		unresolved: {
			pending: {}
		},
		resolved: [ 'resolve', Potential() ]
	})
});
function UnaryDeferral ( fn, args ) {
	if ( !( this instanceof UnaryDeferral ) ) { return new UnaryDeferral( fn, args ); }
	Deferral.call( this, { done: 'resolve' }, fn, args );
}



//////////////

Deferral.Binary = Z.inherit( BinaryDeferral, Deferral, {
	state: State({
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
