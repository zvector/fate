( function ( undefined ) {

module( "when" );

asyncTest( "when()", function () {
	var	d1 = new Deferral,
		d2 = new Deferral,
		p2 = d2.promise(),
		w,
		result; d1['']='d1',d2['']='d2',p2['']='p2';
	
	function setResult ( value ) {
		return function () {
			result = value;
			// console.log( result );
		}
	}
	
	( w = when(
		when( d1 ).then( setResult( d1 ) ),
		when( p2 ).then( setResult( p2 ) )
	) )
		// .then( function () { console.log( w ); } )
		.then( start ); w['']='w';
	
	setTimeout( function () {
		d1.affirm();
		equal( result, d1, "when( Deferral )" );
	}, 200 );
	
	setTimeout( function () {
		d2.affirm();
		equal( result, p2, "when( Promise )" );
	}, 400 );
});

asyncTest( "when(), all affirmed", function () {
	var	a, b,
		likeDojo = { addCallback: 'callback', addErrback: 'errback' },
		likeJQuery = { done: 'resolve', fail: 'reject' },
		d1 = new Deferral,
		d2 = new Deferral( likeDojo ),
		d3 = new Deferral( likeJQuery );
	
	function setA ( value ) {
		return function () {
			a = value;
		}
	}
	function setB ( value ) {
		return function () {
			b = value;
		}
	}
	function doTests () {
		ok( a === true, "a === true" );
		ok( b === true, "b === true" );
	}
	
	Deferral().when( d1.promise(), d2.promise(), d3.promise() )
		.then( setA( true ), setA( false ) )
		.then( setB( true ) )
		.always( doTests, start );
	
	setTimeout( function () {
		d1.affirm();
	}, 25 );
	
	setTimeout( function () {
		d2.callback();
	}, 50 );
	
	setTimeout( function () {
		d3.resolve();
	}, 75 );
});

asyncTest( "when(), early negation", function () {
	var	a, b,
		d1 = new Deferral,
		d2 = new Deferral;
	
	function setA ( value ) {
		return function () {
			a = value;
		}
	}
	function setB ( value ) {
		return function () {
			b = value;
		}
	}
	function doTests () {
		ok( a === false, "a === false" );
		ok( b === undefined, "b === undefined" );
	}

	when( d1, d2, 'yes' )
		.then( [ setA( true ), setB( true ) ], setA( false ) )
		.always( doTests, start );
	
	setTimeout( function () {
		d1.negate();
	}, 25 );
	
	setTimeout( function () {
		d2.affirm();
	}, 50 );
});

})();
