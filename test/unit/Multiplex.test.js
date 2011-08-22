( function ( undefined ) {

module( "Multiplex" );

asyncTest( "Multiplex", function () {
	
	var multiplex,
		data;
	
	function async ( fn, delay, test ) {
		return function ( obj ) {
			var deferral = Deferral().as( multiplex ).given( arguments );
			setTimeout( function () {
				equal( fn.call( this, obj ).toString(), test );
				deferral.affirm();
			}, delay );
			return deferral.promise();
		};
	}
	
	function sync( fn, test ) {
		return function () {
			var args = fn.apply( this, arguments );
			equal( args.join(), test );
			return args;
		};
	}
	
	function mutate ( obj ) {
		obj.x += 1, obj.y += 1, obj.z += 1;
		return obj;
	}
	
	data = {
		x:1, y:2, z:3,
		toString: function () {
			return [ this.x, this.y, this.z ].join();
		}
	};
	
	// Test may not be stable; final two assertions may execute in inverted order
	multiplex = new Multiplex( 3, [
		async( mutate, 100, '4,5,6' ),
		async( mutate, 90, '3,4,5' ),
		async( mutate, 80, '2,3,4' ),
		async( mutate, 70, '7,8,9' ),
		async( mutate, 60, '6,7,8' ),
		async( mutate, 50, '5,6,7' ),
		async( mutate, 40, '11,12,13' ),
		async( mutate, 30, '9,10,11' ),
		async( mutate, 20, '8,9,10' ),
		async( mutate, 10, '10,11,12' )
	]);
	
	multiplex.start( data ).promise()
		.then( function ( obj ) {
			equal( obj.toString(), '11,12,13', "Complete" );
		})
		.always( start )
	;
});

})();