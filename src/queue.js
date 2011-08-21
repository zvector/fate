function Queue ( operations ) {
	if ( !( this instanceof Queue ) ) {
		return new Queue( operations );
	}
	
	var	self = this,
		operation,
		args,
		deferral,
		running = false,
		pausePending = false;
	
	function next () {
		return operation = operations.shift();
	}
	
	function continuation () {
		var result;
		if ( isFunction( this ) ) {
			result = this.apply( self, arguments );
			if ( Promise.resembles( result ) ) {
				result.then(
					function () {
						args = slice.call( arguments );
						pausePending && ( running = pausePending = false );
						running && continuation.apply( operation = operations.shift(), args );
					},
					function () {
						deferral.as( self ).given( args ).negate();
					}
				);
			} else {
				args = slice.call( arguments );
				running && continuation.apply( next(), isArray( result ) ? result : [ result ] );
			}
		} else {
			args = slice.call( arguments );
			self.stop();
		}
	}
	
	function start () {
		deferral = new Deferral;
		running = true;
		this.start = getThis, this.pause = pause, this.resume = resume, this.stop = stop;
		continuation.apply( next(), args = slice.call( arguments ) );
		return this;
	}
	
	function pause () {
		pausePending = true;
		this.resume = resume, this.pause = getThis;
		return this;
	}
	
	function resume () {
		running = true, pausePending = false;
		this.pause = pause, this.resume = getThis;
		continuation.apply( next(), args );
		return this;
	}
	
	function stop () {
		running = pausePending = false;
		this.start = start, this.pause = this.resume = this.stop = getThis;
		deferral.as( self ).given( args ).affirm();
		return this;
	}
	
	forEach( Queue.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	extend( this, {
		length: valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		operation: function () { return operation; },
		args: function () { return slice.call( args ); },
		isRunning: valueFunction( function () { return running; } ),
		start: start,
		pause: getThis,
		resume: getThis,
		stop: getThis
	});
}
extend( Queue, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});
