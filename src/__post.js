extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	Queue: Queue,
	when: when,
	Procedure: Procedure
});

})( typeof module === 'undefined' ? { exports: {} } : module );
