(function($){
    $.fn.overflowing = function(options, callback){
        this.each(function(){

            let el = $(this)[0];
            if (el.offsetHeight < el.scrollHeight ||
                el.offsetWidth < el.scrollWidth) {
                return true;
            } else {
                return false;
            }
        });
    }
})(jQuery)