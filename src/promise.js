/**
 * `Promise` is a limited interface into a `Deferral` instance. It exposes a subset of the deferral's
 * methods, such that consumers of the promise may use it to add callbacks to the represented deferral,
 * and to query the deferral's state, but are prevented from affecting its state as would be done with
 * the deferral's `affirm` and `negate` methods.
 */
function Promise ( deferral ) {
	var self = this,
		i = Promise.methods.length;
	while ( i-- ) {
		( function ( name ) {
			self[ name ] = function () {
				var result = deferral[ name ].apply( deferral, arguments );
				return result === deferral ? self : result;
			};
		})( Promise.methods[i] );
	}
	this.serves = function ( master ) {
		return master === deferral;
	};
}
extend( true, Promise, {
	methods: 'isAffirmed isNegated isResolved yes no then always pipe promise'.split(' '),
	
	// Used to test whether an object is or might be able to act as a Promise.
	resembles: function ( obj ) {
		return obj && (
			obj instanceof Promise ||
			obj instanceof Deferral ||
			isFunction( obj.then ) && isFunction( obj.promise )
		);
	}
});
