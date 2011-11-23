/**
 * `Promise` is a limited interface into a `Deferral` instance, consisting of a particular subset of
 * the deferral's methods. Consumers of the promise are prevented from affecting the represented
 * deferral's resolution state, but they can use it to query its state and to register callbacks.
 */
Z.inherit( Promise, Future,
	null,
	{
		methods: 'registerTo then always pipe promise did resolution state progress potential resolvers'.split(' ')
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