/**
 * `Promise` is a limited interface into a `Deferral` instance, consisting of a particular subset of
 * the deferral's methods. Consumers of the promise are prevented from affecting the represented
 * deferral's resolution state, but they can use it to query its state and to register callbacks.
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
