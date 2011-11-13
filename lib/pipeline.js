/**
 * A **pipeline** executes a sequence of synchronous or asynchronous functions in order, passing a set of
 * arguments from one to the next as each operation completes.
 */
function Pipeline ( operations ) {
	if ( !( this instanceof Pipeline ) ) {
		return new Pipeline( operations );
	}
	
	var	self = this,
		context = self,
		operation,
		args,
		deferral,
		running = false,
		pausePending = false,
		events = Z.nullHash([ 'didOperation', 'willContinue' ]);
	
	function returnSelf () {
		return self;
	}
	
	function reset () {
		return deferral = ( new Deferral ).as( context );
	}
	
	function shift () {
		return operation = operations.shift();
	}
	
	function emit ( eventType, obj ) {
		var	callbacks = events[ eventType ],
			i, l,
			data = Z.extend( { target: self, operation: operation, args: args }, obj );
		if ( callbacks ) {
			for ( i = 0, l = callbacks.length; i < l; i++ ) {
				callbacks[i].call( self, data );
			}
		}
	}
	
	function continuation () {
		var result;
		
		while ( operation != null || ( operation = operations.shift() ) != null ) {
			result = Z.isFunction( operation ) ? operation.apply( self, args ) : operation;
			
			// Asynchronous: schedule a deferred recursion and return immediately
			if ( Future.resembles( result ) ) {
				result.then(
					function () {
						args = Z.slice.call( arguments );
						emit( 'didOperation' );
						pausePending && ( running = pausePending = false );
						if ( running ) {
							if ( ( operation = operations.shift() ) != null ) {
								emit( 'willContinue' );
								continuation.apply( operation, args );
							} else {
								self.stop();
							}
						}
					},
					self.abort
				);
				return;
			}
			
			// Synchronous: loop until an asynchronous operation or the end of the pipeline is encountered
			else {
				args = Z.isArray( result ) ? result : [ result ];
				emit( 'didOperation' );
				pausePending && ( running = pausePending = false );
				if ( running ) {
					if ( ( operation = operations.shift() ) != null ) {
						emit( 'willContinue' );
						continue;
					}
					else {
						break;
					}
				}
			}
		}
		
		self.stop();
	}
	
	function as ( context_ ) {
		deferral.as( context = context_ );
		return self;
	}
	
	function given ( args_ ) {
		deferral.given( args = args_ );
		return self;
	}
	
	function start () {
		( !deferral || deferral.did() ) && reset();
		running = true;
		
		self.as = self.given = self.start = returnSelf;
		self.pause = pause, self.resume = resume, self.stop = stop, self.abort = abort;
		
		continuation.apply( shift(), arguments.length ? ( args = Z.slice.call( arguments ) ) : args );
		return self;
	}
	
	function pause () {
		pausePending = true;
		self.resume = resume, self.pause = returnSelf;
		return self;
	}
	
	function resume () {
		running = true, pausePending = false;
		self.pause = pause, self.resume = returnSelf;
		continuation.apply( shift(), args );
		return self;
	}
	
	function stop () {
		running = pausePending = false;
		
		self.as = as, self.given = given, self.start = start;
		self.pause = self.resume = self.stop = self.abort = returnSelf;
		
		deferral.given( args ).affirm();
		return self;
	}
	
	function abort () {
		running = pausePending = false;
		
		self.as = as, self.given = given, self.start = start;
		self.pause = self.resume = self.stop = self.abort = returnSelf;
		
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
		as: as,
		given: given,
		start: start,
		pause: returnSelf,
		resume: returnSelf,
		stop: returnSelf,
		abort: returnSelf,
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
