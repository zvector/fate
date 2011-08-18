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




asyncTest( "pipe", function () {
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

asyncTest( "Nesting Queue/when", function () {
	var	number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var d = new Deferral.Unary;
			setTimeout( function () {
				// console.log( n + ": " + ( ( new Date ).getTime() - time ) );
				ok( n === ++number, n );
				d.resolve();
			}, 100 );
			return d.promise();
		};
	}
	
	function parallel () {
		var args = Array.prototype.slice.call( arguments );
		return function () {
			for ( var i = 0, l = args.length; i < l; i++ ) { args[i] = args[i](); }
			return when( args );
		};
	}
	function series () {
		var args = Array.prototype.slice.call( arguments );
		return function () { return Queue( args ).start( arguments ).promise(); };
	}
	
	series(
		fn(1),
		parallel(
			fn(2),
			parallel( fn(3), fn(4) ),
			series( fn(5), fn(6) )
		),
		series( fn(7), fn(8) )
	)()
		.then( start );
});

asyncTest( "Mixing in jQuery promises", function () {
	Procedure( [[
		function () {
			console.log("1");
			ok( true );
			return Deferral.Nullary();
		},
		[
			function () {
				return jQuery.ajax( '/', {} )
					.then( function () { console.log("2") }, function () { console.log("failed"); } )
					.always( function () { ok( true ); } );
			},
			function () {
				return jQuery.ajax( '/', {} )
					.then( function () { console.log("3") }, function () { console.log("failed"); } )
					.always( function () { ok( true ); } );
			}
		],
		function () {
			console.log("4");
			ok( true );
			return Deferral.Nullary();
		}
	]] )
		.start()
		.then( start );
});

})();
