extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	Pipeline: Pipeline,
	when: Deferral.prototype.when,
	Multiplex: Multiplex,
	Procedure: Procedure
});

})( typeof module === 'undefined' ? { exports: {} } : module );
