function OperationQueue ( operations ) {
	var	self = this,
		queue = Array.prototype.slice.call( operations ),
		deferral = new Deferral;
	
	function continuation () {
		if ( isFunction( this ) ) {
			this.apply( self, arguments ).then( function () {
				continuation.apply( queue.shift(), arguments );
			});
		} else {
			deferral.affirm( self, arguments );
		}
	}
	function start () {
		this.start = noop, this.stop = stop;
		continuation.apply( queue.shift(), arguments );
		return this.promise();
	}
	function stop () {
		this.start = start, this.stop = noop;
		return this.promise();
	}
	
	forEach( 'push pop shift unshift reverse splice'.split(' '), function ( method ) {
		this[ method ] = function () {
			return Array.prototype[ method ].apply( queue, arguments );
		};
	});
	
	extend( this, {
		length: ( function () {
			function f () { return queue.length; }
			return ( f.valueOf = f );
		})(),
		promise: function () {
			return deferral.promise();
		},
		start: start,
		stop: noop
	});
}
