/**
 * 
 */
function Deferral ( fn ) {
	var	callbacks, bind, resolve;
	
	( this.empty = function () {
		callbacks = { done: [], fail: [] };
		return this;
	})();
	
	this.__private__ = {
		callbacks: callbacks
	};
	
	bind = Deferral.privileged.bind( callbacks );
	resolve = Deferral.privileged.resolve( callbacks );
	extend( this, {
		done: bind( 'done' ),
		fail: bind( 'fail' ),
		fulfill: resolve( 'done' ),
		forfeit: resolve( 'fail' )
	});
	bind = resolve = null;
	
	fn && isFunction( fn ) && fn.apply( this, slice( arguments, 1 ) );
}
extend( true, Deferral, {
	anti: { done: 'fail', fail: 'done' },
	privileged: {
		/** Produces a function that pushes callbacks onto one of the callback queues. */
		bind: function ( callbacks ) {
			return function ( as ) { // as = { 'done' | 'fail' }
				return function ( fn ) {
					isFunction( fn ) && callbacks[as].push( fn ) || isArray( fn ) && forEach( fn, this[as] );
					return this;
				};
			};
		},
		
		/** Produces a function that resolves the deferral as either fulfilled or forfeited. */
		resolve: function ( callbacks ) {
			return function ( as ) { // as = { 'done' | 'fail' }
				var not = Deferral.anti[as];
				return function ( context, args ) {
					this[as] = this.invoke( callbacks ), this[not] = this.resolve = noop;
					callbacks.context = context, callbacks.args = args;
					this.invokeAll( callbacks )( callbacks[as] );
					delete callbacks[as], delete callbacks[not];
					return this;
				};
			};
		}
	},
	prototype: {
		/** Determines whether the deferral has been fulfilled. */
		isFulfilled: function () {
			return this.fail === noop ? true : this.done === noop ? false : undefined;
		},
		
		/** Determines whether the deferral has been forfeited. */
		isForfeited: function () {
			return this.done === noop ? true : this.fail === noop ? false : undefined;
		},
		
		/** Determines whether the deferral has been either fulfilled or forfeited. */
		isResolved: function () {
			return this.done === noop || this.fail === noop;
		},
		
		/** Returns a function that will become the deferral's `done` or `fail` method once it has been resolved. */
		invoke: function ( callbacks ) {
			var self = this;
			return function ( fn ) {
				try {
					isFunction( fn ) && fn.apply( callbacks.context || self, callbacks.args )
						||
					isArray( fn ) && self.invokeAll( callbacks )( fn );
				} catch ( nothing ) {}
				return !!fn;
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( callbacks ) {
			var self = this;
			return function ( fns ) {
				while ( self.invoke( callbacks )( fns.shift() ) );
			};
		},
		
		/** Unified interface for adding `done` and `fail` callbacks. */
		then: function ( done, fail ) {
			return this.done( done ).fail( fail );
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is fulfilled or not.
		 */
		always: function () {
			var fns = slice( arguments );
			return this.done( fns ).fail( fns );
		},
		
		/** Returns a `Promise` bound to this deferral. */
		promise: function () {
			return new Promise( this );
		}
	},
	then: function () {
		return ( new Deferral() ).then( arguments );
	}
});
