var etsFs = {
	isAppInit: false,
	baseUrl: '',
	initApp: function () {
		if (this.isAppInit) {
			return false;
		}
		if (typeof ETS_FS_BASE_URL !== 'undefined') {
			etsFs.baseUrl = ETS_FS_BASE_URL;
		}
		if (typeof ETS_FS_INIT === 'undefined' || !ETS_FS_INIT || typeof ETS_FS_DATA === 'undefined' || !ETS_FS_DATA) {
			return false;
		}
		this.isAppInit = true;
	}
}
document.addEventListener("DOMContentLoaded", function () {
	if (typeof ETS_FS_INIT == 'undefined' || !ETS_FS_INIT) {
		var etsFsCounterApp = 0;
		var etsFSIntervalApp = setInterval(function () {
			if (typeof ETS_FS_INIT !== 'undefined' && ETS_FS_INIT) {
				etsFs.initApp();
				clearInterval(etsFSIntervalApp);
			}
			etsFsCounterApp += 200;
			if (etsFsCounterApp >= 5000) {
				clearInterval(etsFSIntervalApp);
			}
		}, 200);
	} else {
		etsFs.initApp();
	}
});