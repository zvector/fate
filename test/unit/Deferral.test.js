( function ( undefined ) {

module( "Deferral" );

asyncTest( "Deferral", function () {
	var d = new Deferral( function ( a, b, c ) {
		this.then( function ( x, y, z ) {
				ok( a === x && b === y && c === z );
				ok( a === 1 && b === 2 && c === 3 );
			})
			.affirm( a, b, c );
	}, [ 1, 2, 3 ] );
	ok( d.did('affirm') );
	start();
});

asyncTest( "Nullary Deferral", function () {
	var	context = {},
		d = Deferral.Nullary( context, [ 1, 2, 3 ] );
	strictEqual( d.did(), true );
	strictEqual( d.resolution(), true );
	ok( d.promise() );
	strictEqual( d.did(), d.promise().did() );
	strictEqual( d.resolution(), d.promise().resolution() );
	ok( d.as() === d );
	d.promise().then( function ( a, b, c ) {
		ok( this === context && a === 1 && b === 2 && c === 3 );
	});
	start();
});

asyncTest( "then()", function () {
	var result,
		map = { yes: 'affirm', no: 'negate', maybe: 'punt', unanswerable: 'reject' },
		d1 = new Deferral( map ),
		d2 = new Deferral( map );
	
	function setResult ( value ) {
		return function () { result = value; };
	}
	
	d1
		.then( setResult( true ), setResult( false ), setResult( null ), setResult( undefined ) )
		.always( function () {
			ok( result === null, "punted, result === null" );
			equal( d1.resolution(), 'maybe', "Resolved to 'maybe'" );
		});
	d2
		.then( setResult( true ), setResult( false ), setResult( null ), setResult( undefined ) )
		.always( function () {
			ok( result === undefined, "rejected, result === undefined" );
			equal( d2.resolution(), 'unanswerable', "Resolved to 'unanswerable'" );
		});
	
	setTimeout( function () { d1.punt(); }, 50 );
	setTimeout( function () { d2.reject(); }, 75 );
	setTimeout( start, 100 );
});

asyncTest( "pipe()", function () {
	var deferral = new Deferral;
	deferral
		.pipe( function ( value ) {
			equal( value, 3 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 4 ); }, 60 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 4 );
			return 2;
		})
		.pipe( function ( value ) {
			equal( value, 2 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 5 ); }, 40 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 5 );
			return 6;
		})
		.pipe( function ( value ) {
			equal( value, 6 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 8 ); }, 70 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 8 );
			return 7;
		})
		.pipe( function ( value ) {
			equal( value, 7 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 1 ); }, 30 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 1 );
			return 9;
		})
		.pipe( function ( value ) {
			equal( value, 9 );
		})
		.then( start )
	;
	deferral.affirm( 3 );
});

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
	
	( w = Deferral.when(
		Deferral.when( d1 ).then( setResult( d1 ) ),
		Deferral.when( p2 ).then( setResult( p2 ) )
	) )
		// .then( function () { console.log( w ); } )
		.then( start ); w['']='w';
	
	setTimeout( function () {
		d1.affirm();
		equal( result, d1, "Deferral.when( Deferral )" );
	}, 200 );
	
	setTimeout( function () {
		d2.affirm();
		equal( result, p2, "Deferral.when( Promise )" );
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

	Deferral.when( d1, d2, 'yes' )
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
