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

// this is static/shared on the deferral prototype; it should not hold reference to any deferral instance

function State ( superstate, name ) {
	if ( !( this instanceof State ) ) {
		return Z.isPlainObject( superstate ) ?
			( new State( undefined, name ) ).addSubstates( superstate ) :
			new State( superstate, name );
	}
	
	var path;
	
	Z.extend( this, {
		superstate: function ( value ) {
			return superstate === undefined ? ( superstate = value ) : superstate;
		},
		name: function ( value ) {
			return name === undefined ? ( name = value ) : name || '';
		},
		path: function () {
			var lineage;
			return path || name && (
					path = ( lineage = superstate && superstate.path() ) ?
						lineage + '.' + name :
						name
				) || '';
		}
	});
	this.name.toString = this.name;
	this.path.toString = this.path;
	
	return this;
}
Z.extend( true, State, {
	prototype: {
		toString: function () {
			return this.path();
		},
		
		substate: function ( path ) {
			return path ? Z.lookup( this.substates, path.replace( /\./g, '.substates.' ) ) : this;
		},
		
		substateList: function () {
			var	states = this.substates,
				key, result = [];
			for ( key in states ) {
				result.push( states[ key ] );
			}
			return result;
		},
		
		root: function () {
			var superstate = this.superstate();
			return ( superstate ? superstate.root() : superstate ) || this;
		},
		
		derivation: function ( after ) {
			var cursor, result = [];
			for ( cursor = this; cursor && ( !after || cursor !== after ); cursor = cursor.superstate() ) {
				result.unshift( cursor );
			}
			return result;
		},
		
		isSuperstateOf: function ( substate ) {
			var superstate = substate.superstate();
			return superstate && ( this === superstate || this.isSuperstateOf( superstate ) );
		},
		
		isOrIsSuperstateOf: function ( state ) {
			return this === state || this.isSuperstateOf( state );
		},
		
		isRelated: function ( state ) {
			return this.root() === state.root();
		},
		
		counterpart: function ( foreignState ) {
			return foreignState.root().substate( this.path() );
		},
		
		isCounterpartOf: function ( foreignState ) {
			return this.path() === foreignState.path();
		},
		
		addSubstate: function ( type, name ) {
			var	args = Z.slice.call( arguments ),
				state;
			
			Z.isFunction( type ) && type.prototype instanceof State ||
				( name = type, args.unshift( type = this.constructor ) );
			
			state = Z.create( type.prototype );
			args[0] = this;
			type.apply( state, args );
			return ( this.substates || ( this.substates = {} ) )[ name ] = state;
		},
		
		addSubstates: function ( input ) {
			var	key, value,
				substates = this.substates ||
					input && !Z.isEmpty( input ) && ( this.substates = {} );
			
			for ( key in input ) if ( Z.hasOwn.call( input, key ) ) {
				value = input[ key ];
				substates[ key ] =
					value instanceof State ?
						( value.superstate( this ), value.name( key ), value ) :
					Z.isString( value ) ?
						this.addSubstate( key, value ) :
					Z.isPlainObject( value ) ?
						this.addSubstate( key ).addSubstates( value ) :
					Z.isArray( value ) ?
						this.addSubstate( key, value[0] ).addSubstates( value[1] ) :
					this.addSubstate( key );
			}
			
			return this;
		}
	},
	
	lookup: function ( subject, state ) {
		state instanceof this || Z.isString( state ) && ( state = subject.substate( state ) );
		return state && subject.isSuperstateOf( state ) && state;
	}
});

Deferral.State = State;


Z.inherit( ResolvedState, State );

function ResolvedState ( superstate, name, resolverName ) {
	State.call( this, superstate, name );
	
	( this.resolverName = function () { return resolverName; })
		.toString = this.resolverName;
	
	return this;
}

Deferral.ResolvedState = ResolvedState;

/**
 * Potential represents the branch of possible terminal states of a deferral; i.e., a deferral's
 * "resolved" State.
 */
Z.inherit( Potential, ResolvedState );

function Potential ( data, superstate, name, resolverName ) {
	if ( !( this instanceof Potential ) ) {
		return new Potential( data );
	}
	
	return ResolvedState.call( this, superstate, name, resolverName )
		.addSubstates( data );
}
Z.extend( Potential.prototype, {
	addSubstate: function ( type, name ) {
		var args = Z.slice.call( arguments );
		
		// Substate types of Potential should default to ResolvedState rather than Potential
		type && Z.isFunction( type ) ?
			type.prototype instanceof Potential && ( type = ResolvedState ) :
			( name = type, args.unshift( type = ResolvedState ) )
		
		return ResolvedState.prototype.addSubstate.apply( this, args );
	}
});

Deferral.Potential = Potential;

function Future () {
	throw new TypeError; // abstract
}

Z.extend( 'deep', Future, {
	prototype: {
		/**
		 * Unified interface for registering callbacks. Multiple arguments are registered to callback
		 * queues in respective order; e.g. `Deferral().then( fn1, fn2 )` registers `fn1` to the
		 * first queue (`yes`) and `fn2` to the second queue (`no`).
		 */
		then: function () {
			var	stateNames = Z.keys( this.potential().substates ),
				i = 0, sl = stateNames.length, al = arguments.length, l = Math.min( sl, al );
			for ( ; i < l; i++ ) {
				this.resolved[ stateNames[i] ]( arguments[i] );
			}
			al > sl &&
				0; // TODO: any remaining argument becomes a progress event handler, as per CommonJS Promises/A
			return this;
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is affirmed or not.
		 */
		always: function () {
			var	fns = Z.slice.call( arguments ),
				stateNames = Z.keys( this.potential().substates ),
				i = 0, l = stateNames.length;
			for ( ; i < l; i++ ) {
				this.resolved[ stateNames[i] ]( fns );
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
				states = potential.substates,
				key, resolverName, fn,
				i = 0, l = arguments.length,
				next = new Deferral( potential );
		
			for ( key in states ) {
				if ( i < l ) {
					( function ( resolverName, fn ) {
						function pipe () {
							var key_,
								result = fn.apply( this, arguments ),
								promise_ = result && Promise.resembles( result ) ?
									result.promise() :
									undefined;
							if ( promise_ ) {
								for ( key_ in states ) {
									promise_[ key_ ]( next[ states[ key_ ].resolverName() ] );
								}
							} else {
								next.as( this === self ? next : this )[ resolverName ]( result );
							}
						}
						self[ key ]( Z.isFunction( fn ) ? pipe : next[ resolverName ] );
					})( states[ key ].resolverName(), arguments[ i++ ] );
				} else { break; }
			}
			return next.promise();
		}
	},
	
	// Used to test whether an object is or might be able to act as a Future/Deferral/Promise.
	resembles: function ( obj ) {
		return obj && (
			obj instanceof Future ||
			Z.isFunction( obj.then ) && Z.isFunction( obj.promise )
		);
	}
});

/**
 * Object used by a deferral instance to store callback queues that are associated with its
 * resolved substates.
 * 
 * Queues are stored in either of two tree structures. Each tree is a sparse reflection of
 * the owning deferral's state hierarchy, specified in `rootState`. The first tree is the
 * "capture" tree, and the second is the "bubble" tree. When a deferral is resolved, it
 * retrieves callbacks to be invoked by first walking the capture tree, from the root state
 * down to the targeted state, and then walking the bubble tree, from the targeted state
 * back up to the root state.
 */
function CallbackQueueTree ( rootState ) {
	var root, cache;
	
	Z.extend( this, {
		/**
		 * Returns the callback queue Array associated with the specified `state`; creates it if necessary.
		 */
		get: function ( state, flags ) {
			flags = flags ? Z.splitToHash( flags, ' ' ) : {};
			
			var	bubble = flags.bubble,
				capture = flags.capture || !bubble,
				readonly = flags.readonly,
				
				trunk = capture ? 'capture' : 'bubble',
				path = state.path(),
				cacheTrunk = cache[ trunk ],
				obj = cacheTrunk && cacheTrunk[ path ],
				derivation, name, next, i, l;
			
			if ( obj ) { return obj; }
			
			obj = root[ trunk ];
			derivation = state.derivation( rootState );
			i = 0, l = derivation.length;
			while ( i < l && obj ) {
				name = derivation[i].name();
				next = obj[ name ] || ( readonly ? undefined : ( obj[ name ] = [] ) );
				next && (
					++i < l ?
						Z.isArray( next ) &&
							( next = readonly ? undefined : ( obj[ name ] = { '': next } ) )
						:
						Z.isArray( next ) || ( next = next[''] )
				);
				obj = next;
			}
			return obj && ( cacheTrunk[ path ] = obj );
		},
		
		/**
		 * Discards callback queues; optionally limited to those associated with the specified state
		 * and its substates.
		 */
		empty: function ( state ) {
			var obj, path, pathDot, key, cacheTrunk, deletions, length;
			
			if ( !state || state === baseState ) {
				root = { capture: { '':[] }, bubble: { '':[] } };
				cache = { capture: {}, bubble: {} };
			}
			else if ( baseState.isSuperstateOf( state ) ) {
				path = state.superstate().path();
				Z.forEach( [ 'capture', 'bubble' ], function ( trunk ) {
					obj = Z.lookup( root[ trunk ], path );
					if ( obj ) {
						// Prune the branch associated with this state
						obj[ state.name() ] = null;
					
						// Remove any related cached entries
						cacheTrunk = cache[ trunk ], pathDot = path + '.';
						for ( key in cacheTrunk ) if ( Z.hasOwn.call( cacheTrunk, key ) ) {
							( key === path || key.indexOf( pathDot ) === 0 ) &&
								deletions.push( key );
						}
						for ( length = deletions.length; --length; ) {
							delete cacheTrunk[ deletions.pop() ];
						}
					}
				});
			}
			return this;
		}
	});
	
	this.empty();
}


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
				Z.extend( {}, resolution );
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
				i, l, j, lj;
			
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
					direction;
				
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
				
				direction =
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
				
				return { affirmative: direction[0], negative: direction[1] };
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
				direction = direct( future );
				
				/*
				 * If this future resolves to any of the specified states, this will accordingly
				 * affect the master deferral as directed for an affirmative result ...
				 */
				for ( j = 0, lj = states.length || states.push( true ); j < lj; j++ ) {
					state = states[j];
					Z.isBoolean( state ) && ( state = potential.substateList()[0] );
					future.registerTo( state, direction.affirmative );
				}
				
				/*
				 * ... or, if this future resolves to a state that was *not* specified, this will
				 * conversely affect the master deferral as directed for a negative result.
				 */
				future.registerTo( potential, direction.negative, true );
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
	}
});

// Deferral.prototype.state = State({
// 	unresolved: {
// 		pending: {}
// 	},
// 	resolved: Potential({
// 		yes: 'affirm',
// 		no: 'negate'
// 	})
// });

( function () {
	var J = Deferral.privileged.join( null );
	Z.extend( Deferral, {
		when: Z.extend( J( 'when all' ), {
			all: J( 'when all' ),
			any: J( 'when any' ),
			none: J( 'when none' )
		}),
		unless: Z.extend( J( 'unless all' ), {
			all: J( 'unless all' ),
			any: J( 'unless any' ),
			none: J( 'unless none' )
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
		promise;
	
	Z.extend( this, {
		resolution: function () { return Z.extend( {}, resolution ); },
		did: function () { return true; },
		promise: function () { return promise || ( promise = new Promise( this ) ); },
		potential: function () { return resolution.state; },
		primaries: Z.noop,
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


/**
 * `Promise` is a limited interface into a `Deferral` instance, consisting of a particular subset of
 * the deferral's methods. Consumers of the promise are prevented from affecting the represented
 * deferral's resolution state, but they can use it to query its state and to register callbacks.
 */
Z.inherit( Promise, Future,
	null,
	{
		methods: 'registerTo then always pipe promise did resolution potential resolvers'.split(' ')
	}
);

function Promise ( deferral ) {
	var self = this,
		methods = Promise.methods,
		i = methods.length;
	
	while ( i-- ) {
		( function ( name ) {
			self[ name ] = function () {
				var result = deferral[ name ].apply( deferral, arguments );
				return result === deferral ? self : result;
			};
		})( methods[i] );
	}
	
	Promise.createMethods( self, { resolved: deferral.potential() }, deferral, self );
	
	Z.extend( 'own', self, self.resolved, {
		serves: function ( master ) {
			return Z.isFunction( master ) ?
				deferral instanceof master :
				master === deferral;
		}
	});
}
Promise.createMethods = function ( subject, states, deferral, promise ) {
	var key, state, stateName;
	
	for ( key in states ) if ( Z.hasOwn.call( states, key ) ) {
		state = states[ key ], stateName = state.name();
		
		subject[ stateName ] = ( function ( fn ) {
			return function () {
				var result = Z.isFunction( fn ) && fn.apply( deferral, arguments );
				return result === deferral ? promise : result;
			};
		})( Z.lookup( deferral, state.path() ) );
		
		state.substates &&
			this.createMethods( subject[ stateName ], state.substates, deferral, promise );
	}
};

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
		return Z.create( from || scope || null, { __procedure__: self } );
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

