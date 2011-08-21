extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	Pipeline: Pipeline,
	when: when,
	Procedure: Procedure
});

})( typeof module === 'undefined' ? { exports: {} } : module );
