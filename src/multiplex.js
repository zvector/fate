function Multiplex ( width, operations ) {
	if ( !( this instanceof Multiplex ) ) {
		return new Multiplex( width, operations );
	}
	if ( arguments.length === 1 ) {
		operations = argument[0], width = operations.length;
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( this ),
		args,
		running = false,
		pipeCount = 0,
		first, last;
	
	function fill () {
		while ( pipeCount < width && operations.length ) {
			addPipe();
		}
	}
	
	function addPipe () {
		var pipe = Pipeline( operations )
			.on( 'didOperation', didOperation )
			.on( 'willContinue', willContinue )
		;
		last = last ? ( ( pipe.previous = last ).next = pipe ) : ( first = pipe );
		pipe.promise().always( function () {
			removePipe( pipe );
		});
		running && pipe.start.apply( pipe, args );
		pipeCount++;
		return pipe;
	}
	
	function removePipe ( pipe ) {
		var previous = pipe.previous, next = pipe.next;
		previous && ( previous.next = next ), next && ( next.previous = previous );
		previous || next || self.stop();
		return pipe;
	}
	
	function didOperation ( event ) {
		args = event.args;
	}
	
	function willContinue ( event ) {
		var pipe = event.target;
		if ( pipeCount > width ) {
			pipeCount--;
			pipe.stop();
		} else if ( pipeCount < width ) {
			// operations may have been added
			fill();
		}
	}
	
	function start () {
		args = slice.call( arguments );
		running = true;
		this.start = getThis, this.stop = stop;
		fill();
		return this;
	}
	
	function stop () {
		running = false;
		this.start = start, this.stop = getThis;
		deferral.given( args ).affirm();
		return this;
	}
	
	forEach( Multiplex.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	extend( this, {
		length: valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		width: function ( value ) {
			if ( value !== undefined ) {
				width = value;
				fill();
			}
			return width;
		},
		isRunning: valueFunction( function () { return running; } ),
		start: start,
		stop: getThis
	});
}
extend( Multiplex, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});