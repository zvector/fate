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
	
	// May not be a stable test; processing order is not always well defined when multiple timeouts coincide
	multiplex = new Multiplex( 3, [
		async( mutate, 100, '5,6,7' ), // A 100
		async( mutate, 10, '2,3,4' ), // B 10
		async( mutate, 80, '4,5,6' ), // C 80
		async( mutate, 30, '3,4,5' ), // B 40
		async( mutate, 60, '6,7,8' ), // B 100
		async( mutate, 50, '7,8,9' ), // C 130
		async( mutate, 40, '8,9,10' ), // A 140
		async( mutate, 70, '10,11,12' ), // B 170
		async( mutate, 20, '9,10,11' ), // C 150
		async( mutate, 90, '11,12,13' ) // A 230
	]);
	
	multiplex.start( data ).promise()
		.then( function ( obj ) {
			equal( obj.toString(), '11,12,13', "Complete" );
		})
		.always( start )
	;
});

})();