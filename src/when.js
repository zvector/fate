/**
 * Binds together the fate of all the deferrals submitted as arguments. Returns a promise which will be
 * either affirmed after each individual deferral is affirmed, or negated immediately after any one
 * deferral is negated.
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


function when2 ( deferrals, resolution ) {
	var	length = deferrals.length,
		remaining = length,
		i = 0,
		deferral;
}