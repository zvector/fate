function OperationQueue ( operations ) {
	var	self = this,
		queue = slice.call( operations ),
		deferral = new Deferral,
		running = false,
		pausePending = false,
		args;
	
	function continuation () {
		var result;
		if ( isFunction( this ) ) {
			result = this.apply( self, arguments );
			if ( Promise.resembles( result ) ) {
				result.then( function () {
					args = slice.call( arguments );
					pausePending && ( running = pausePending = false );
					running && continuation.apply( queue.shift(), args );
				});
			} else {
				args = slice.call( arguments );
				running && continuation.apply( queue.shift(), isArray( result ) ? result : [ result ] );
			}
		} else {
			deferral.affirm( self, arguments );
		}
	}
	function start () {
		running = true, this.start = noop, this.pause = pause, this.resume = resume, this.stop = stop;
		continuation.apply( queue.shift(), args = slice.call( arguments ) );
		return this;
	}
	function pause () {
		pausePending = true, this.resume = resume, this.pause = noop;
		return this;
	}
	function resume () {
		running = true, pausePending = false, this.pause = pause, this.resume = noop;
		continuation.apply( queue.shift(), args );
		return this;
	}
	function stop () {
		running = pausePending = false, this.pause = this.resume = this.stop = noop;
		return this;
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
		pause: noop,
		resume: noop,
		stop: noop,
		isRunning: ( function () {
			function f () { return running; }
			return ( f.valueOf = f );
		})
	});
}
