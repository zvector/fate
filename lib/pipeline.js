/**
 * A **pipeline** executes a sequence of synchronous or asynchronous functions in order, passing a set of
 * arguments from one to the next as each operation completes.
 */
function Pipeline ( operations, context ) {
	if ( !( this instanceof Pipeline ) ) {
		return new Pipeline( operations );
	}
	
	var	self = this,
		operation,
		args,
		deferral,
		running = false,
		pausePending = false,
		events = Z.nullHash([ 'didOperation', 'willContinue' ]);
	
	function reset () {
		return deferral = ( new Deferral ).as( context || self );
	}
	
	function shift () {
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
		if ( Z.isFunction( this ) ) {
			result = this.apply( self, arguments );
			if ( Promise.resembles( result ) ) {
				result.then(
					function () {
						args = Z.slice.call( arguments );
						emit( 'didOperation' );
						pausePending && ( running = pausePending = false );
						running && ( operation = operations[0] ) && emit( 'willContinue' );
						running && continuation.apply( shift(), args );
					},
					self.abort
				);
			} else {
				args = Z.slice.call( arguments );
				running && continuation.apply( shift(), Z.isArray( result ) ? result : [ result ] );
			}
		} else {
			args = Z.slice.call( arguments );
			self.stop();
		}
	}
	
	function start () {
		( !deferral || deferral.did() ) && reset();
		running = true;
		self.start = Z.getThis, self.pause = pause, self.resume = resume, self.stop = stop, self.abort = abort;
		continuation.apply( shift(), args = Z.slice.call( arguments ) );
		return self;
	}
	
	function pause () {
		pausePending = true;
		self.resume = resume, self.pause = Z.getThis;
		return self;
	}
	
	function resume () {
		running = true, pausePending = false;
		self.pause = pause, self.resume = Z.getThis;
		continuation.apply( shift(), args );
		return self;
	}
	
	function stop () {
		running = pausePending = false;
		self.start = start, self.pause = self.resume = self.stop = self.abort = Z.getThis;
		deferral.given( args ).affirm();
		return self;
	}
	
	function abort () {
		running = pausePending = false;
		self.start = start, self.pause = self.resume = self.stop = self.abort = Z.getThis;
		deferral.given( args ).negate();
		return self;
	}
	
	Z.forEach( Pipeline.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	Z.extend( this, {
		length: Z.valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		operation: function () { return operation; },
		args: function () { return Z.slice.call( args ); },
		isRunning: Z.valueFunction( function () { return running; } ),
		start: start,
		pause: Z.getThis,
		resume: Z.getThis,
		stop: Z.getThis,
		abort: Z.getThis,
		on: function ( eventType, fn ) {
			var callbacks = events[ eventType ] || ( events[ eventType ] = [] );
			return callbacks && callbacks.push( fn ) && this;
		}
	});
	
	reset();
}
Z.extend( Pipeline, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});
