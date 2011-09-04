( function ( undefined ) {

module( "Promise" );

var	Deferral = Fate.Deferral,
	Promise = Fate.Promise;

asyncTest( "promise()", function () {
	var d = new Deferral,
		p1 = d.promise(),
		p2 = p1.promise();
	ok( p1.serves( d ), "deferral.promise().serves( deferral )" );
	ok( p2.serves( d ), "deferral.promise().promise().serves( deferral )" );
	ok( p1 === p2, "deferral.promise() === deferral.promise().promise()" );
	ok( Promise.resembles( { then: function () {}, promise: function () {} } ), "Promise.resembles generic promise-like object" );
	ok( Promise.resembles( jQuery.Deferred() ), "Promise.resembles jQuery.Deferred()" );
	ok( Promise.resembles( jQuery.Deferred().promise() ), "Promise.resembles jQuery.Deferred().promise()" );
	ok( !p1.resolution() && !p2.resolution(), "initially unresolved" );
	d.affirm();
	ok( p1.resolution() && p2.did('affirm') && p2.resolution('yes') && !p1.resolution('no') && !p1.did('negate'), "deferral.affirm reflected in promises" );
	start();
});

})();
