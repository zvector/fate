( function ( undefined ) {

module( "Deferral" );

var Deferral = Fate.Deferral;

1&&
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

1&&
asyncTest( "Nullary Deferral", function () {
	var	context = {},
		d = Deferral.Nullary( context, [ 1, 2, 3 ] ),
		p;
	strictEqual( d.did(), true, "No resolver methods; parameterless `did` returns `true`" );
	strictEqual( d.resolution().state.name(), 'resolved', "Null state is 'resolved'" );
	strictEqual( p = d.promise(), d.promise(), "Memoized promise" );
	strictEqual( d.did(), p.did() );
	strictEqual( d.resolution().state, p.resolution().state, "State reference consistent between deferral and promise" );
	strictEqual( d.as(), d, "`as` returns self" );
	p.then( function ( a, b, c ) {
		ok( this === context && a === 1 && b === 2 && c === 3 );
	});
	start();
});

1&&
asyncTest( "then()", function () {
	var result,
		potential = { yes: 'affirm', no: 'negate', maybe: 'punt', unanswerable: 'reject' },
		d1 = new Deferral( potential ),
		d2 = new Deferral( potential );
	
	function setResult ( value ) {
		return function () { result = value; };
	}
	
	d1
		.then( setResult( true ), setResult( false ), setResult( null ), setResult( undefined ) )
		.always( function () {
			ok( result === null, "punted, result === null" );
			equal( d1.resolution().state.name(), 'maybe', "Resolved to 'maybe'" );
		});
	d2
		.then( setResult( true ), setResult( false ), setResult( null ), setResult( undefined ) )
		.always( function () {
			ok( result === undefined, "rejected, result === undefined" );
			equal( d2.resolution().state.name(), 'unanswerable', "Resolved to 'unanswerable'" );
		});
	
	setTimeout( function () { d1.punt(); }, 50 );
	setTimeout( function () { d2.reject(); }, 75 );
	setTimeout( start, 100 );
});

1&&
asyncTest( "pipe()", function () {
	var	deferral = new Deferral;
	deferral
		.pipe( function ( value ) {
			equal( value, 3 );
			var d = new Deferral;
			setTimeout( function () {
				d.affirm( 4 );
			}, 60 );
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

1&&
asyncTest( "when()", function () {
	var	d1 = new Deferral,
		d2 = new Deferral,
		p2 = d2.promise(),
		w, w1, w2,
		result;
	
	function setResult ( value ) {
		return function () {
			result = value;
			// console.log( result );
		}
	}
	
	d1['']='d1',d2['']='d2',p2['']='p2';
	
	w1 = Deferral.when( d1 ).then( setResult( d1 ) );
	w2 = Deferral.when( p2 ).then( setResult( p2 ) );
	( w = Deferral.when( w1, w2 ) )
		// .then( function () { console.log( w ); } )
		.then( start ); w['']='w';
	
	setTimeout( function () {
		d1.affirm();
		equal( result, d1, "Deferral.when( Deferral )" );
	}, 20 );
	
	setTimeout( function () {
		d2.affirm();
		equal( result, p2, "Deferral.when( Promise )" );
	}, 40 );
});

1&&
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

1&&
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

1&&
asyncTest( "when variants: when.any, when.none, unless.~", 13, function () {
	var	d1 = new Deferral,
		d2 = new Deferral;
	
	Deferral.when(
		Deferral.when.any( d1, d2, 'yes' )
			.then( function ( deferral ) {
				ok( deferral === d1 );
				ok( deferral.resolution().arguments[0] === 1 );
				ok( d1.did() && !d2.did(), "resolved: ( d1, !d2 )" );
			}),
		Deferral.when.none( d1, d2, 'no' )
			.then( function () {
				var deferrals = Z.slice.call( arguments );
				ok( deferrals.length === 2 );
				ok( deferrals[0] === d1 && deferrals[1] === d2 );
				ok( d1.did('yes') && d2.did('yes') );
				ok( d1.did('affirm') && d2.did('affirm') );
				ok( !d1.did('no') && !d2.did('no') );
				ok( !d1.did('negate') && !d2.did('negate') );
			}),
		Deferral.unless.all( d1, d2, 'no' )
			.then( function () {
				var deferral = arguments[0];
				ok( deferral === d1, "unless.all 'no'" );
				ok( arguments.length === 1 );
			}),
		Deferral.unless.any( d1, d2, 'no' )
			.then( function () {
				var deferrals = Z.slice.call( arguments );
				ok( deferrals.length === 2, "unless.any 'no'" );
			}),
		Deferral.unless.none( d1, d2, 'yes' )
			.then( function () {
				ok( true, "unless.none 'yes'" );
			}),
		'yes'
	).always( start );
	
	setTimeout( function () {
		d1.affirm( 1 );
	}, 20 );
	
	setTimeout( function () {
		d2.affirm( 2 );
	}, 40 );
});

1&&
asyncTest( "Joins using a complex state deferral", 5, function () {
	Z.inherit( MyDeferral, Deferral );
	Z.extend( MyDeferral.prototype, {
		state: Deferral.State({
			unresolved: {
				pending: null
			},
			resolved: Deferral.Potential({
				fubar: 'oops',
				snafu: [ 'nuts', {
					derped: 'derp'
				}]
			})
		})
	});
	function MyDeferral () {
		Deferral.apply( this, arguments );
	}
	
	var	d1 = new MyDeferral,
		d2 = new MyDeferral;
	
	Deferral.when(
		Deferral.when( d1, d2, 'snafu' )
			.then( function ( first, second ) {
				ok( d2 === first && d1 === second );
				ok( d1.did('snafu') && d2.did('snafu') );
				ok( d1.did('nuts') && d2.did('derp') );
			}),
		Deferral.when.any( d1, d2, 'snafu.derped' )
			.then( function ( deferral ) {
				ok( deferral === d2 );
				ok( !d1.did() );
			})
	).always( start );
	
	setTimeout( function () {
		d1.nuts( 1 );
	}, 40 );
	
	setTimeout( function () {
		d2.derp( 2 );
	}, 20 );
});

1&&
asyncTest( "Casting a foreign promise to a Deferral", 1, function () {
	Deferral.cast( jQuery.ajax( '/', {} ) )
		.yes( function ( responseText, statusText, jqXHR ) {
			ok( true, statusText );
		})
		.no( function () {
			ok( false );
		})
		.always( start );
});

})();
