/* Overflowing.js
 *
 * A plugin based on Elving Rodriguez's Overflowed
 * http://elvingrodriguez.com/overflowed
 *
 */
(function ($) {
    $.fn.overflowing = function () {
        if ($(this)[0].scrollWidth > $(this).innerWidth() || $(this)[0].scrollHeight > $(this).innerHeight() ) {
            return true;
        } else {
            return false;
        }
    }
})(jQuery)