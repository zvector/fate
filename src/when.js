/**
 * Binds together the fate of all the deferrals submitted as arguments, returning a promise that will be
 * fulfilled only after all the individual deferrals are fulfilled, or will be forfeited immediately after
 * any one deferral is forfeited.
 */
function when ( arg /*...*/ ) {
	var	args = flatten( slice( arguments ) ),
		length = args.length || 1,
		unresolvedCount = length,
		i = 0,
		deferral = length === 1 ?
			arg instanceof Deferral ?
				arg
				:
				( deferral = new Deferral ).fulfill( deferral, arg )
			:
			new Deferral;
	
	function fulfill () {
		--unresolvedCount || deferral.fulfill( deferral, arguments );
	}
	
	if ( length > 1 ) {
		for ( ; i < length; i++ ) {
			arg = args[i];
			arg instanceof Deferral || arg instanceof Promise ||
				( arg = args[i] = ( new Deferral ).fulfill( deferral, arg ) );
			arg.then( fulfill, deferral.forfeit );
		}
	}
	
	return deferral.promise();
}
