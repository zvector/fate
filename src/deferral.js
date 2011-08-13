/**
`Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

@param Object map : Hashmap whose entries represent the set of resolved substates for the deferral;
		keys specify a name for the substate's callback queue, and values specify a name for the
		resolution method used to transition to that substate and execute its associated callbacks.
@param Function fn : A function that will be executed immediately in the context of the deferral.
@param Array args : Array of arguments to be passed to `fn`.
 */
function Deferral ( map, fn, args ) {
	if ( !( this instanceof Deferral ) ) {
		return new Deferral( map, fn, args );
	}
	if ( map == null || isFunction( map ) ) {
		return new Deferral.Binary( arguments[0], arguments[1] );
	}
	
	var	self = this,
		callbacks,
		resolution, resolutionContext, resolutionArguments,
		register, resolve,
		promise;
	
	function setResolution ( name ) { return name in map && ( resolution = name ); }
	function getResolutionContext () { return resolutionContext; }
	function setResolutionArguments ( args ) { return resolutionArguments = args; }
	
	extend( this, {
		empty: function () {
			callbacks = {};
			each( map, function ( key ) { callbacks[ key ] = []; });
			return this;
		},
		map: function () { return extend( {}, map ); },
		queueNames: function () { return keys( map ); },
		resolution: function ( test ) {
			return test ? test === resolution || ( test in map ? false : undefined ) : resolution;
		},
		did: function ( resolver ) {
			return resolver ? !!resolution && resolver === map[ resolution ] : !!resolution;
		},
		promise: function () {
			return promise || ( promise = new Promise( this ) );
		},
		as: function ( context ) {
			resolutionContext = context;
			return this;
		}
	});
	this.queueNames.toString = function () { return self.queueNames().join(' ') };
	this.resolution.toString = this.resolution;
	
	this.empty();
	register = Deferral.privileged.register( callbacks );
	resolve = Deferral.privileged.resolve( callbacks, setResolution, getResolutionContext, setResolutionArguments );
	
	each( map, function ( name, resolver ) {
		self[ name ] = register( name );
		self[ resolver ] = resolve( name );
	});
	
	register = resolve = null;
	
	fn && isFunction( fn ) && fn.apply( this, args );
}
extend( true, Deferral, {
	privileged: {
		/**
		 * Produces a function that pushes callbacks onto one of the callback queues.
		 */
		register: function ( callbacks ) {
			return function ( resolution ) { // e.g. { 'yes' | 'no' }
				return function ( fn ) {
					isFunction( fn ) && callbacks[ resolution ].push( fn ) ||
						isArray( fn ) && forEach( fn, this[ resolution ] );
					return this;
				};
			};
		},
		
		/**
		 * Produces a function that resolves the deferral, transitioning it to one of its resolved substates.
		 */
		resolve: function ( callbacks, setResolution, getResolutionContext, setResolutionArguments ) {
			return function ( resolution ) {
				return function () {
					var	self = this,
						name,
						map = this.map(),
						context = getResolutionContext(),
						args = slice.call( arguments );
					
					setResolution( resolution );
					setResolutionArguments( args );
					
					/*
					 * The deferral has transitioned to a 'resolved' substate ( e.g. affirmed | negated ),
					 * so the behavior of its callback registration methods are redefined to reflect this.
					 * A closure preserves the current execution state as `context` and `args`; henceforth,
					 * callbacks that would be registered to the queue named `resolution` will instead be
					 * called immediately with the saved `context` and `args`, while subsequent callback
					 * registrations to any of the other queues are deemed invalid and will be discarded.
					 */
					this[ resolution ] = Deferral.privileged.invoke( this, callbacks )( context, args );
					this[ map[ resolution ] ] = this.as = getThis;
					delete map[ resolution ];
					for ( name in map ) {
						this[ name ] = this[ map[ name ] ] = getThis;
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
						isFunction( fn ) ? fn.apply( context || deferral, args ) :
						isArray( fn ) && Deferral.privileged.invokeAll( deferral, callbacks )( context, args )( fn );
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
			var map = keys( this.map() ), i = 0, l = Math.min( map.length, arguments.length );
			while ( i < l ) { this[ map[i] ]( arguments[i++] ); }
			return this;
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is affirmed or not.
		 */
		always: function () {
			var name, map = this.map(), fns = slice.call( arguments );
			for ( name in map ) { this[ name ]( fns ); }
			return this;
		},
		
		/**
		 * Arranges deferrals in a pipeline.
		 * Functions passed as the arguments may be asynchronous, returning a promise or deferral, in which
		 * case this deferral passes its resolution state to a successive deferral.
		 */
		pipe: function () {
			var	self = this,
				map = this.map(),
				key, resolver, fn,
				i = 0, l = arguments.length,
				next = new Deferral( map );
			for ( key in map ) {
				if ( i < l ) {
					resolver = map[key];
					fn = arguments[i++];
					this[key](
						isFunction( fn ) ?
							function () {
								var result = fn.apply( this, arguments ),
									promise = result && Promise.resembles( result ) ?
										result.promise() : undefined;
								promise ?
									promise.then( next.affirm, next.negate ) :
									next.as( this === self ? next : this )[ resolver ]( result );
							} :
							next[ resolver ]
					);
				} else break;
			}
			return next.promise();
		}
	}
});


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