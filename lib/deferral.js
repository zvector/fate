/**
 * `Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.
 * 
 * @param Object map : Hashmap whose entries represent the set of resolved substates for the deferral;
 * 		keys specify a name for the substate's callback queue, and values specify a name for the
 * 		resolution method used to transition to that substate and execute its associated callbacks.
 * @param Function fn : A function that will be executed immediately in the context of the deferral.
 * @param Array args : Array of arguments to be passed to `fn`.
 */
function Deferral ( map, fn, args ) {
	if ( !( this instanceof Deferral ) ) {
		return new Deferral( map, fn, args );
	}
	if ( map === undefined || Z.isFunction( map ) ) {
		return new Deferral.Binary( arguments[0], arguments[1] );
	}
	
	
	var	self = this,
		callbacks,
		resolution, resolutionContext, resolutionArguments,
		register, resolve,
		promise;
	
	function setResolution ( name ) { return name in map && ( resolution = name ); }
	function getResolutionContext () { return resolutionContext; }
	function getResolutionArguments () { return resolutionArguments; }
	function setResolutionArguments ( args ) { return resolutionArguments = args; }
	
	
	Z.extend( this, {
		resolution: Z.stringFunction( function ( test ) {
			return test ? test === resolution || ( test in map ? false : undefined ) : resolution;
		}),
		did: function ( resolver ) {
			return resolver ? !!resolution && resolver === map[ resolution ] : !!resolution;
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
	if ( map === null ) {
		resolution = true;
		this.map = this.queueNames = Z.noop;
		this.as = this.given = this.empty = Z.getThis;
		this.then = Deferral.privileged.invoke( this, null )
			( resolutionContext = arguments[1], resolutionArguments = arguments[2] );
		this.always = function () { return this.then( Z.slice.call( arguments ) ); };
	}
	
	// Normal (n > 0)-ary deferral
	else {
		Z.extend( this, {
			map: function () { return Z.extend( {}, map ); },
			queueNames: Z.stringFunction( function () { return Z.keys( map ); } ),
			as: function ( context ) {
				resolutionContext = context;
				return this;
			},
			given: function ( args ) {
				resolutionArguments = args;
				return this;
			},
			empty: function () {
				callbacks = {};
				Z.each( map, function ( key ) { callbacks[ key ] = []; });
				return this;
			}
		});
		
		this.empty();

		register = Deferral.privileged.register( callbacks );
		resolve = Deferral.privileged.resolve(
			callbacks, setResolution, getResolutionContext, getResolutionArguments, setResolutionArguments
		);
	
		Z.each( map, function ( name, resolver ) {
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
		register: function ( callbacks ) {
			return function ( resolution ) { // e.g. { 'yes' | 'no' }
				return function ( fn ) {
					Z.isFunction( fn ) && callbacks[ resolution ].push( fn ) ||
						Z.isArray( fn ) && Z.forEach( fn, this[ resolution ] );
					return this;
				};
			};
		},
		
		/**
		 * Produces a function that resolves the deferral, transitioning it to one of its resolved substates.
		 */
		resolve: function ( callbacks, setResolution, getResolutionContext, getResolutionArguments, setResolutionArguments ) {
			return function ( resolution ) {
				return function () {
					var	self = this,
						name,
						map = this.map(),
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
					this[ resolution ] = Deferral.privileged.invoke( this, callbacks )( context, args );
					this[ map[ resolution ] ] = this.as = this.given = Z.getThis;
					delete map[ resolution ];
					for ( name in map ) {
						this[ name ] = this[ map[ name ] ] = Z.getThis;
					}
					
					Deferral.privileged.invokeAll( this, callbacks )( context, args )( callbacks[ resolution ] );
					
					delete callbacks[ resolution ];
					for ( name in map ) { delete callbacks[ name ]; }
					
					return this;
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
			return function ( context, args ) {
				return function ( fn ) {
					try {
						Z.isFunction( fn ) ? fn.apply( context || deferral, args ) :
						Z.isArray( fn ) && Deferral.privileged.invokeAll( deferral, callbacks )( context, args )( fn );
					} catch ( nothing ) {}
					return deferral;
				};
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( deferral, callbacks ) {
			return function ( context, args ) {
				return function ( fns ) {
					var invoke = Deferral.privileged.invoke( deferral, callbacks )( context, args );
					for ( i = 0, l = fns.length; i < l; i++ ) {
						invoke( fns[i] );
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
			var map = Z.keys( this.map() ), i = 0, l = Math.min( map.length, arguments.length );
			while ( i < l ) { this[ map[i] ]( arguments[ i++ ] ); }
			return this;
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is affirmed or not.
		 */
		always: function () {
			var name, map = this.map(), fns = Z.slice.call( arguments );
			for ( name in map ) { this[ name ]( fns ); }
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
				map = this.map(),
				key, resolver, fn,
				i = 0, l = arguments.length,
				next = new Deferral( map );
			for ( key in map ) {
				if ( i < l ) {
					resolver = map[ key ];
					fn = arguments[ i++ ];
					this[ key ](
						Z.isFunction( fn ) ?
							function () {
								var key,
									result = fn.apply( this, arguments ),
									promise = result && Promise.resembles( result ) ?
										result.promise() : undefined;
								if ( promise ) {
									for ( key in map ) {
										promise[ key ]( next[ map[ key ] ] );
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
				i, promise, queueNames, affirmativeQueue, map, name;

			function affirmed ( p ) {
				return function () {
					list.push( p ) === length && master.affirm.apply( master, list );
				};
			}
			function negated ( p ) {
				return function () {
					list.push( p );
					master.negate.apply( master, list );
				};
			}

			if ( length > 1 && Z.type( promises[ length - 1 ] ) === 'string' ) {
				resolution = promises.splice( --length, 1 )[0];
			}

			for ( i = 0; i < length; i++ ) {
				promise = promises[i];
				if ( promise instanceof Deferral || promise instanceof Promise ) {
					queueNames = promise.queueNames();

					// (n > 0)-ary deferral: affirm on the matching queue and negate on any others
					if ( queueNames && queueNames.length ) {

						// Determine which of this promise's callback queues matches the specified `resolution`
						affirmativeQueue = resolution || queueNames[0];

						// `map` becomes a list referencing the callback queues not considered affirmative in this context
						map = promise.map();
						if ( affirmativeQueue in map ) {
							delete map[ affirmativeQueue ];
						} else {
							// Because this promise will never be resolved to match `resolution`, the master deferral
							// can be negated immediately
							list.push( promise );
							master.negate.apply( master, list );
							break;
						}

						promise[ affirmativeQueue ]( affirmed( promise ) );
						for ( name in map ) {
							promise[ name ]( negated( promise ) );
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

				// For anything that isn't promise-like, force whatever `promise` is to play nice with the
				// other promises by wrapping it in a nullary deferral.
				else {
					promises[i] = Deferral.Nullary( master, promise );
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
Deferral.Binary = BinaryDeferral;