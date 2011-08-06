/**
 * Binds together the fate of all the deferrals submitted as arguments, returning a promise that will be
 * affirmed only after all the individual deferrals are affirmed, or will be negated immediately after
 * any one deferral is negated.
 */
function when ( arg /*...*/ ) {
	var	args = flatten( slice.call( arguments ) ),
		length = args.length || 1,
		unresolvedCount = length,
		i = 0,
		deferral = length === 1 ?
			arg instanceof Deferral ?
				arg
				:
				( deferral = new Deferral ).affirm( deferral, arg )
			:
			new Deferral;
	
	function affirm () {
		--unresolvedCount || deferral.affirm( deferral, arguments );
	}
	
	if ( length > 1 ) {
		for ( ; i < length; i++ ) {
			arg = args[i];
			arg instanceof Deferral || arg instanceof Promise ||
				( arg = args[i] = ( new Deferral ).affirm( deferral, arg ) );
			arg.then( affirm, deferral.negate );
		}
	}
	
	return deferral.promise();
}
