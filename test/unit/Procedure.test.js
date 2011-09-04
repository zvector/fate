( function ( assert, undefined ) {

module( "Procedure" );

var	Deferral = Fate.Deferral,
	Pipeline = Fate.Pipeline,
	Procedure = Fate.Procedure;

asyncTest( "Nesting Pipeline/when", 8, function () {
	var	number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var deferral = Deferral();
			setTimeout( function () {
				deferral[ n === ++number ? 'affirm' : 'negate' ]
					( 'fn(' + n + ') @ t=' + ( ( new Date ).getTime() - time ) );
			}, 10 );
			return deferral.then(
				function ( message ) {
					assert.ok( true, message );
				},
				function ( message ) {
					assert.ok( false, message );
				}
			);
		};
	}
	
	function parallel () {
		var args = Array.prototype.slice.call( arguments );
		return function () {
			for ( var i = 0, l = args.length; i < l; i++ ) {
				args[i] = args[i]();
			}
			return Deferral.when( args );
		};
	}
	function series () {
		var args = Array.prototype.slice.call( arguments );
		return function () {
			return Pipeline( args ).start( arguments ).promise();
		};
	}
	
	series(
		fn(1),
		parallel(
			fn(2),
			series( fn(3), fn(6) ),
			parallel( fn(4), fn(5) )
		),
		series( fn(7), fn(8) )
	)()
		.then( start );
});

asyncTest( "Using a plain function", 2, function () {
	Procedure( function ( a, b, c ) {
		assert.ok( a === 1 && b === 2 && c === 3 );
		return [ a + 3, b + 3, c + 3 ];
	})
		.start( 1, 2, 3 )
		.then( function ( d, e, f ) {
			assert.ok( d === 4 && e === 5 && f === 6 );
		})
		.always( start );
});

asyncTest( "Using a series of plain functions", 4, function () {
	Procedure([
		function ( a, b ) {
			assert.ok( a === 1 && b === 2 );
			return [ a + 2, b + 2 ];
		},
		function ( c, d ) {
			assert.ok( c === 3 && d === 4 );
			return [ c + 2, d + 2 ];
		},
		function ( e, f ) {
			assert.ok( e === 5 && f === 6 );
			return [ e + 2, f + 2 ];
		}
	])
		.start( 1, 2 )
		.then( function ( g, h ) {
			assert.ok( g === 7 && h === 8 );
		})
		.always( start );
});

asyncTest( "Using serial/parallel literals", 22, function () {
	var number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var deferral = Deferral();
			setTimeout( function () {
				deferral[ n === ++number ? 'affirm' : 'negate' ]
					( 'fn(' + n + ') @ t=' + ( ( new Date ).getTime() - time ) );
			}, 10 );
			return deferral.then(
				function ( message ) {
					assert.ok( true, message );
				},
				function ( message ) {
					assert.ok( false, message );
				}
			);
		};
	}
	
	Procedure([
		fn(1),
		[[
			fn(2),
			[[
				fn(3),
				fn(4),
				[
					fn(5),
					[[
						fn(11),
						fn(12),
						[[ fn(13), fn(14) ]]
					]],
					fn(17),
					[
						fn(18),
						fn(19)
					]
				],
				fn(6),
				[[
					fn(7),
					[ fn(8), fn(15) ]
				]],
				fn(9)
			]],
			[ fn(10), fn(16) ]
		]],
		[ fn(20), fn(21) ],
		fn(22)
	])
		.start()
		.always( start );
	
	// Tick sequence:
	// 1
	// 2 3 4 5 6 7 8 9 10
	// 11 12 13 14 15 16
	// 17
	// 18
	// 19
	// 20
	// 21
	// 22
});

asyncTest( "Using multiplex literals", 22, function () {
	var number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var deferral = Deferral();
			setTimeout( function () {
				deferral[ n === ++number ? 'affirm' : 'negate' ]
					( 'fn(' + n + ') @ t=' + ( ( new Date ).getTime() - time ) );
			}, 10 );
			return deferral.then(
				function ( message ) {
					assert.ok( true, message );
				},
				function ( message ) {
					assert.ok( false, message );
				}
			);
		};
	}
	
	Procedure([
		fn(1),
		[[
			fn(2),
			{ 2:[
				fn(3),
				fn(4),
				[
					fn(6),
					[[
						fn(9),
						// { yes: fn(10), no: fn(0) },
						fn(10),
						[[ fn(11), fn(12) ]]
					]],
					fn(15),
					[
						fn(17),
						fn(19)
					]
				],
				fn(7),
				[[
					fn(13),
					[ fn(14), fn(16) ]
				]],
				fn(18)
			]},
			[ fn(5), fn(8) ]
		]],
		[ fn(20), fn(21) ],
		fn(22)
	])
		.start()
		.always( start );
	
	// Tick sequence:
	// 1
	// 2 3 4 5
	// 6 7 8
	// 9 10 11 12 13 14
	// 15 16
	// 17 18
	// 19
	// 20
	// 21
	// 22
});

asyncTest( "Mixing in jQuery promises", 4, function () {
	Procedure( [[
		function () {
			// console.log("1");
			assert.ok( true );
			return Deferral.Nullary();
		},
		[
			function () {
				return jQuery.ajax( '/', {} )
					.then(
						function () {
							// console.log("2");
						},
						function () {
							console.log("failed");
						}
					)
					.always( function () {
						assert.ok( true );
					});
			},
			function () {
				return jQuery.ajax( '/', {} )
					.then(
						function () {
							// console.log("3")
						},
						function () {
							console.log("failed");
						}
					)
					.always( function () {
						assert.ok( true );
					});
			}
		],
		function () {
			// console.log("4");
			assert.ok( true );
			return Deferral.Nullary();
		}
	]] )
		.start()
		.then( start );
});

})( QUnit );