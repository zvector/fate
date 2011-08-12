/**
`Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

@param Array map : Hashmap whose entries represent the set of resolved substates for the deferral;
		keys specify a name for the substate's callback queue, and values specify a name for the
		resolution method used to transition to that substate and execute its associated callbacks.
@param Function fn : A function that will be executed immediately in the context of the deferral.
 */
function Deferral ( map, fn, args ) {
	if ( !( this instanceof Deferral ) ) {
		return new Deferral( map, fn, args );
	}
	
	var	self = this,
		callbacks,
		resolution,
		register, resolve,
		promise;
	
	function setResolution ( name ) { return name in map && ( resolution = name ); }
	
	isFunction( map ) && ( args = fn, fn = map, map = undefined );
	map === undefined && ( map = { yes: 'affirm', no: 'negate' } );
	
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
			callbacks.context = context;
			return this;
		}
	});
	this.queueNames.toString = function () { return self.queueNames().join(' ') };
	this.resolution.toString = this.resolution;
	
	this.empty();
	register = Deferral.privileged.register( callbacks );
	resolve = Deferral.privileged.resolve( callbacks, setResolution );
	
	each( map, function ( name, resolver ) {
		self[ name ] = register( name );
		self[ resolver ] = resolve( name );
	});
	
	register = resolve = null;
	
	fn && isFunction( fn ) && fn.apply( this, args );
}
extend( true, Deferral, {
	privileged: {
		/** Produces a function that will become the deferral's `yes` or `no` method once it has been resolved. */
		invoke: function ( deferral, callbacks ) {
			return function ( fn ) {
				var	context = callbacks.context || deferral,
					args = callbacks.args;
				try {
					isFunction( fn ) ? fn.apply( context, args ) :
					isArray( fn ) && Deferral.privileged.invokeAll( deferral, callbacks )( fn );
				} catch ( nothing ) {}
				return deferral;
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( deferral, callbacks ) {
			return function ( fns ) {
				for ( i = 0, l = fns.length; i < l; i++ ) {
					Deferral.privileged.invoke( deferral, callbacks )( fns[i] );
				}
			};
		},
		
		/**
		 * Produces a function that pushes callbacks onto one of the callback queues.
		 * @see yes, no
		 */
		register: function ( callbacks ) {
			return function ( as ) { // `as` = { 'yes' | 'no' }
				return function ( fn ) {
					isFunction( fn ) && callbacks[as].push( fn ) || isArray( fn ) && forEach( fn, this[as] );
					return this;
				};
			};
		},
		
		/**
		 * Produces a function that resolves the deferral, transitioning it to one of its resolved substates.
		 * @see affirm, negate
		 */
		resolve: function ( callbacks, setResolution ) {
			return function ( as ) {
				return function ( context, args ) {
					var	self = this,
						name,
						map = this.map();
					
					setResolution( as );
					/*
					 * The deferral has transitioned to a 'resolved' substate ( e.g. affirmed | negated ),
					 * so the behavior of its callback registration methods are redefined to reflect this.
					 * Henceforth, functions passed to the method named `as` will be called immediately
					 * with the same `context` and `args` supplied here, while those passed to any of the
					 * other registration methods will be ignored.
					 */
					this[as] = Deferral.privileged.invoke( this, callbacks );
					this[ map[as] ] = getThis;
					delete map[as];
					for ( name in map ) {
						this[ name ] = this[ map[ name ] ] = getThis;
					}
					
					callbacks.context = context, callbacks.args = args;
					Deferral.privileged.invokeAll( this, callbacks )( callbacks[as] );
					
					delete callbacks[as];
					for ( name in map ) { delete callbacks[ name ]; }
					
					return this;
				};
			};
		}
	},
	prototype: {
		/**
		 * Unified interface for registering callbacks. Multiple arguments are registered to callback
		 * queues in respective order; e.g. `( new Deferral() ).then( fn1, fn2 )` registers `fn1` to the
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
		 * @param Function `yes`
		 * @param Function `no`
		 * Functions passed as the arguments may be asynchronous, returning a promise or deferral, in which
		 * case this deferral passes its resolution state to a successive deferral
		 * that return a deferral or promise Passing a promise or deferral as arguments for
		 * `yes` and/or `no` causes wherein the resolution of a preceding deferral
		 * (`this`) is passed.
		 */
		pipe: function ( yes, no ) {
			var	self = this,
				map = this.map(),
				key, resolver, fn,
				i = 0, l = arguments.length,
				next = new Deferral;
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
									next[ resolver ]( this === self ? next : this, [ result ] );
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