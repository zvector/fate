/**
 * `Promise` is a limited interface into a `Deferral` instance. Consumers of the promise may add
 * callbacks to the represented deferral, and may check its resolved/fulfilled states, but cannot affect
 * the deferral itself as would be done with the deferral's `fulfill` and `forfeit` methods.
 */
function Promise ( deferral ) {
	var promise = this,
		i = Promise.methods.length;
	while ( i-- ) {
		( function ( name ) {
			promise[name] = function () {
				deferral[name].apply( deferral, arguments );
				return promise;
			};
		})( Promise.methods[i] );
	}
}
extend( Promise, {
	methods: 'isResolved isFulfilled done fail then always'.split(' '),
	
	/** Weakly duck-types an object against `Promise`, checking for `then()` */
	resembles: function ( obj ) {
		return obj && isFunction( obj.then );
	}
});
