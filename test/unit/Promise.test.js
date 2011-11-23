1&&( function ( undefined ) {

module( "Promise" );

var	Deferral = Fate.Deferral,
	Promise = Fate.Promise;

asyncTest( "promise()", function () {
	var d = new Deferral,
		p1 = d.promise(),
		p2 = p1.promise(),
		r1, r2;
	ok( p1.serves( d ), "deferral.promise().serves( deferral )" );
	ok( p2.serves( d ), "deferral.promise().promise().serves( deferral )" );
	ok( p1 === p2, "deferral.promise() === deferral.promise().promise()" );
	ok( Promise.resembles( { then: function () {}, promise: function () {} } ), "Promise.resembles generic promise-like object" );
	ok( Promise.resembles( jQuery.Deferred() ), "Promise.resembles jQuery.Deferred()" );
	ok( Promise.resembles( jQuery.Deferred().promise() ), "Promise.resembles jQuery.Deferred().promise()" );
	ok( p1.state().name() === 'unresolved' && p2.state().name() === 'unresolved', "initially unresolved" );
	d.affirm();
	r1 = p1.resolution(), r2 = p2.resolution();
	ok(
		r1.state.root().substate('resolved').isSuperstateOf( r1.state ) &&
		p2.did('affirm') &&
		p2.resolution('resolved.yes') &&
		!p1.resolution('resolved.no') &&
		!p1.did('negate')
	, "results of deferral.affirm reflected in promises" );
	start();
});

})();
