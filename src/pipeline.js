function Pipeline ( operations ) {
	if ( !( this instanceof Pipeline ) ) {
		return new Pipeline( operations );
	}
	
	var	self = this,
		operation,
		args,
		deferral = ( new Deferral ).as( self ),
		running = false,
		pausePending = false,
		events = nullHash([ 'didOperation', 'willContinue' ]);
	
	function next () {
		return operation = operations.shift();
	}
	
	function emit ( eventType ) {
		var	callbacks = events[ eventType ],
			i, l;
		if ( callbacks ) {
			for ( i = 0, l = callbacks.length; i < l; i++ ) {
				callbacks[i].call( self, { target: self, operation: operation, args: args } );
			}
		}
	}
	
	function continuation () {
		var result;
		if ( isFunction( this ) ) {
			result = this.apply( self, arguments );
			if ( Promise.resembles( result ) ) {
				result.then(
					function () {
						args = slice.call( arguments );
						emit( 'didOperation' );
						pausePending && ( running = pausePending = false );
						running && ( operation = operations[0] ) && emit( 'willContinue' );
						running && continuation.apply( operation = operations.shift(), args );
					},
					function () {
						deferral.given( args ).negate();
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
		if ( !deferral || deferral.did() ) {
			deferral = ( new Deferral ).as( self );
		}
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
		deferral.given( args ).affirm();
		return this;
	}
	
	forEach( Pipeline.arrayMethods, function ( method ) {
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
		stop: getThis,
		on: function ( eventType, fn ) {
			var callbacks = events[ eventType ] || ( events[ eventType ] = [] );
			return callbacks && callbacks.push( fn ) && this;
		}
	});
}
extend( Pipeline, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});
