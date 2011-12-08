1&&( function ( assert, undefined ) {

module( "Procedure" );

var	Deferral = Fate.Deferral,
	Pipeline = Fate.Pipeline,
	Procedure = Fate.Procedure;

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

1&&
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

1&&
asyncTest( "If a deferral element negates", 1, function () {
	Procedure( [
		// this will run and assert ...
		function () {
			var deferral = Deferral();
			setTimeout( function () {
				assert.ok( true );
				deferral.affirm();
			}, 10 );
			return deferral.promise();
		},
		
		function () {
			return Deferral().negate();
		},
		
		// ... but this won't
		function () {
			var deferral = Deferral();
			setTimeout( function () {
				assert.ok( true );
				deferral.affirm();
			}, 10 );
			return deferral.promise();
		}
		
		// so the asyncTest will count only 1 test
	] )
		.start()
		.always( start );
});

/* Coughyscript
p3 = [
	-> 0
	[ 'if'
		-> ( d = Deferral( -> setTimeout( -> d.affirm, 100 ) ) ).promise()
		{
			yes: []
			no: []
		}
	]
	[ 'while', -> ( d = Deferral( -> setTimeout( -> d.affirm, 100 ) ) ).promise()
		[
			-> 'something'
			'break'
		]
	]
	-> 0
]
// */

1&&
asyncTest( "Conditional structure: IF", function () {
	var	number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var	args = Z.slice.call( arguments ),
				deferral = Deferral();
			setTimeout( function () {
				deferral[ n === ++number ? 'affirm' : 'negate' ]
					( 'fn(' + n + ') @ t=' + ( ( new Date ).getTime() - time ) + ' args: ' + args );
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
	
	function delayed ( result, ms ) {
		return function () {
			var d = ( new Deferral ).given( arguments );
			setTimeout( d[ result ], ms );
			return d.promise();
		};
	}
	
	Procedure([
		function () { return Z.slice.call( arguments ); },
		[ 'if', delayed( 'affirm', 10 ), [
			fn(1),
			[[ fn(2), fn(3) ]],
			{2:[ fn(4), fn(5), fn(6) ]}
		], 'else if', delayed( 'affirm', 10 ), [
			fn(1),
			fn(2)
		], 'else', [
			fn(1)
		] ]
	])
		.start( 1, 2, 3 )
		.always( start );
	
	expect( 6 );
});

0&&
asyncTest( "Control structures", function () {
	function fn ( i ) { return function () {}; }
	var	p1 = [ fn(1), [[ fn(2), fn(3) ]], {2:[ fn(4), fn(5), fn(6) ]} ],
		p2 = [[ [ fn(7), fn(9) ], fn(8) ]],
		p3 = [
			function () {},
			[ 'if',
				[], // Array | Function : a possibly asynchronous condition
				
				// If the third argument is an object, use it as a resolution map to apply to the
				// condition's resolution; disregard any subsequent arguments
				
				// Otherwise ...
				[
					// Array | Function : block to execute asynchronously if the condition resolves affirmatively
				],
				
				// if 'else if' is encountered, slice the statement array here, and process that as
				// a new statement array to be executed if the upper condition resolves negatively
				'else if',
				[], // Array | Function : a possibly asynchronous condition
				[], // Array | Function ( | Object ) : block to execute asynchronously if the
					// condition resolves affirmatively
				
				// additional 'else if's, etc.
				
				'else',
				[]  // Array | Function ( | Object ) : block to execute asynchronously if the most
					// recent condition resolves negatively. This is necessarily the last argument
					// in the statement array to be considered
			],
			[ 'if',
				function () {
					return Deferral().promise();
				}, {
					ok: p1,
					error: {
						'': [
							fn(1),
							[[ fn(2), fn(3) ]]
						],
						client: {
							'': [],
							notFound: []
						},
						server: []
					}
				}
			],
			[ 'namedProcedure', [
				p1
			] ],
			[
				function () {
					this.namedProcedure()
						.start();
				}
			],
			[ 'while', function () { return jQuery.ajax('/'); }, [
				p1,
				[ 'if', function () { return this.whatever }, 'return' ],
				p2
			] ],
			[ 'for', [ function () {/*initialization*/}, function () {/*condition*/}, function () {/*iteration*/} ], [
				p1,
				[ 'if', function () { return this.whatever }, 'break' ],
				p2
			] ],
			[ 'try', [ p1, p2 ], 'catch', p1 ],
			function () {}
		];
	Procedure( p3 ).start().always( start );
});

0&&
asyncTest( "Recursion", function () {
	var n = 0,
		p1 = [ 'if',
			function () { return promise; }, {
				yes: [
					function () { n++; },
					function () { return Procedure( p1 ); }
				]
			}
		];
	Procedure( p1 ).start().always( start );
});

})( QUnit );