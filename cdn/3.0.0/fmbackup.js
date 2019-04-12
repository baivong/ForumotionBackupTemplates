/**
 * jsZip (v2.5.0) By StuartKnightley <http://stuartk.com/jszip>
 * jszip-utils (v0.0.2) By Stuart Knightley, David Duponchel <http://stuk.github.io/jszip-utils>
 * FileSaver (2015-05-07.2) By Eli Grey <http://eligrey.com>
 * ForumotionBackupTemplates (v3.0.1) By Zzbaivong <http://devs.forumvi.com>
 */

fmbackup = function () {

    var translation = {},
        trans = {};

    var icons = {},
        setIcons = {};

    var page_id;

    // ------------------------------------ //

    var allowNotification = true;
    Notification.requestPermission(function (result) {
        if (result === "denied") {
            allowNotification = false;
            // console.log("Permission wasn't granted. Allow a retry.");
            return;
        } else if (result === "default") {
            allowNotification = false;
            // console.log("The permission request was dismissed.");
            return;
        }
        allowNotification = true;
    });


    /**
     * Yêu cầu cấp phép bật thông báo nếu chưa được bật
     */
    if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }


    /**
     * Lấy thời gian hiện tại
     * @return {Number} Thời gian hiện tại, không tính giây
     */
    function timestamp() {
        return Math.floor((new Date()).getTime() / 1000);
    }

    /**
     * Chuyển các ký hiệu trong gói ngôn ngữ sang 2 dạng html và text
     * @param  {String} txt Nội dung ghi chú
     * @return {Object}     html, text
     */
    function showTip(txt) {
        return {
            html: txt.replace(/{{([^\}\}]+)}}/g, "<span style=\"color:green\">$1</span>").replace(/\[\[([^\]\]]+)\]\]/g, "<span style=\"color:#444\">$1</span>").replace(/<<([^>>]+)>>/g, "<strong>$1</strong>").replace(/\n/g, "<br />"),
            text: txt.replace(/{{([^\}\}]+)}}/g, "$1").replace(/\[\[([^\]\]]+)\]\]/g, "$1").replace(/<<([^>>]+)>>/g, "$1")
        };
    }


    /**
     * Định dạng thời gian
     * @param  {Number} time Thông số thời gian
     * @return {String}      Thời gian đã định dạng
     */
    function timeFormat(time) {
        var a = (new Date(time)).toString().split(/\s/),
            dd = a[2],
            mm = {
                Jan: "01",
                Feb: "02",
                Mar: "03",
                Apr: "04",
                May: "05",
                Jun: "06",
                Jul: "07",
                Aug: "08",
                Sep: "09",
                Oct: "10",
                Nov: "11",
                Dec: "12"
            }[a[1]],
            yyyy = a[3],
            showTime = mm + "/" + dd + "/" + yyyy + " " + a[4];
        if (trans.langcode === "vi") {
            showTime = dd + "-" + mm + "-" + yyyy + " " + a[4];
        }
        return showTime;
    }


    var tId; // Mã truy cập ACP

    var progressIsRun = true;

    function progressIsRunning(e) {
        var message = trans.progressrun;
        e.returnValue = message;
        return message;
    }

    function alertUnload() {
        if (progressIsRun) {
            $(window).on("beforeunload", progressIsRunning);
        }
        progressIsRun = false;
    }

    function alertUnloadOff() {
        if (!progressIsRun) {
            $(window).off("beforeunload", progressIsRunning);
        }
        progressIsRun = true;
    }

    /**
     * Hiển thị ghi chú kèm biểu tượng
     * @param  {htmlString} mess Nội dung ghi chú
     * @param  {String} icon Loại hiểu tượng: load/info/error/success/disabled
     * @param  {Selector} imp  Vị trí hiển thị ghi chú
     */
    function noti(mess, icon, imp) {
        var showIcon = "<img src=\"" + setIcons[icon] + "\" alt=\"icon\" style=\"height: 13px; width: 13px; vertical-align: middle; margin-top: -3px;\" > ";
        if (!icon) {
            showIcon = "";
        }
        var se = "#exportNoti";
        if (imp) {
            se = "#importNoti";
        }
        $(se).html(showIcon + showTip(mess).html);
        // console.log(showTip(mess).text);
    }


    /**
     * Cuộn đến đối tượng
     * @param  {Selector} Id Đối tượng cần cuộn đến
     */
    function scrollGoto(Id) {
        $("body, html").animate({
            scrollTop: $("#" + Id).offset().top
        });
    }


    var arrTempExport = []; // Danh sách các Template được chon để lưu trữ
    var zip = new JSZip(); // Tạo dữ liệu zip mới
    var prevZip = ""; // Dữ liệu tệp zip trước đó
    var forumVersion = ""; // Phiên bản Forumotion đang sử dụng

    /**
     * Thay thế biểu tượng
     * @param  {Selector} se   Đối tượng có biểu tượng cần thay
     * @param  {String} icon Loại biểu tượng: load/info/error/success/disabled
     */
    function replaceIcon(se, icon) {
        var img = $(se).next("img");
        if (img.length) {
            img.attr({
                "class": "icon_" + icon,
                src: setIcons[icon]
            });
        } else {
            $(se).hide().after("<img class=\"icon_" + icon + "\" src=\"" + setIcons[icon] + "\" alt=\"icon\" style=\"height: 13px; width: 13px;\" />");
        }
    }


    /**
     * Xử lý khi bị từ chối truy cập
     * @param  {Boolean}   exim     Khu vực xảy ra lỗi {true:Import, false:Export}
     * @param  {Number}   time     Thời gian chờ
     * @param  {Selector}   se       Vị trí xảy ra lỗi
     * @param  {String}   temp     Template bị lỗi
     * @param  {Selector}   Id       Vị trí hiển thị đếm ngược tương ứng với khu vực
     * @param  {Function} callback Xử lý khi hết thời gian chờ
     */
    function requestLimit(exim, time, se, temp, Id, callback) {
        var place = "zzExport";
        if (exim) {
            place = "zzImport";
        }
        scrollGoto(place); // Cuộn đến mục bị lỗi

        replaceIcon(se, "error"); // Đổi trạng thái

        noti(trans.errortemplate + temp + "!", "error", exim);
        noti(trans.requestlimit + " <span id=\"" + Id + "\" style=\"color:#FF0080\">" + time + "</span> " + trans.second, "error", exim);
        if (allowNotification) {
            new Notification("Error", {
                body: trans.requestlimit + " " + time + " " + trans.second,
                icon: setIcons.bad
            });
        }
        // Bắt đầu đếm ngược
        var count = time - 1,
            resum = setInterval(function () {
                var result = count--;
                $("#" + Id).html(result);

                if (result <= 0) {
                    clearInterval(resum);
                    replaceIcon(se, "load"); // Đổi trạng thái
                    noti(trans.reloadtemplate + temp + "!", "info", exim);
                    callback(); // Xử lý khi hết thời gian chờ
                }
            }, 1000);
    }

    /**
     * Xuất template ra và tải về máy
     * @param  {Number} n Vị trí template đang xử lý trong danh sách
     */
    function exportTemp(n) {
        var item = arrTempExport[n];
        /**
         * item là một mảng chứa thông tin của Template đang xét như sau
         * [0] Folder
         * [1] Temp Id
         * [2] Temp name
         */

        var bkLeg = arrTempExport.length; // Kiểm tra số lượng Templates sẽ xuất
        var m = n + 1; // Vị trí Temp kế tiếp trong danh sách

        replaceIcon(".cusTemp[value='" + item[1] + "']", "load");

        // Tải Temp đang xét
        $.get("/admin/index.forum?part=themes&sub=templates&mode=edit_" + item[0] + "&t=" + item[1] + "&l=" + item[0] + "&extended_admin=1&tid=" + tId).done(function (data) { // Xử lý khi tải thành công

            zip.file(item[0] + "/" + item[1] + "." + item[2] + ".txt", $(data).find("#template").val()); // Lưu thông tin Temp đã tải vào tệp zip

            noti("(" + m + "/" + bkLeg + ") " + trans.ex.loading, "load");
            replaceIcon(".cusTemp[value='" + item[1] + "']", "success");

            if (m < bkLeg) { // Nếu vẫn còn Temp trong danh sách

                // Tải Temp tiếp theo sau 1 giây (thời gian chờ này là để tránh lỗi từ chối truy cập)
                setTimeout(function () {
                    exportTemp(m);
                }, 1000);
            } else { // Khi tất cả Temp đã tải xong

                var zipName = forumVersion + "." + timestamp() + "." + location.host + ".zip";
                var blob = zip.generate({
                    type: "blob"
                });
                saveAs(blob, zipName); // Tạo tệp zip

                if (prevZip) { // Kiểm tra xem dữ liệu tệp zip cũ còn lưu trong trình duyệt không
                    window.URL.revokeObjectURL(prevZip); // Xóa tệp zip cũ nếu còn
                }
                prevZip = blob; // Lưu tệp zip hiện tại thành dữ liệu zip cũ để dùng khi tải xuống bị lỗi

                $("#exportWait, #exportOne, #exportStart").prop("disabled", false);

                noti("<a href=\"" + window.URL.createObjectURL(blob) + "\" download=\"" + zipName + "\">" + trans.ex.download + "</a>", "success");

                scrollGoto("zzExport");
                $("#refreshTemp").show();

                if (allowNotification) {
                    new Notification("Success", {
                        body: trans.ex.download2,
                        icon: setIcons.good
                    });
                }

                alertUnloadOff();
            }
        }).fail(function () { // Xử lý khi tải bị lỗi

            // Gọi phương thức xử lý khi bị từ chối truy cập, chờ 60 giây trước khi tiếp tụi
            requestLimit(false, 60, ".cusTemp[value='" + item[1] + "']", item[2], "exportResume", function () {
                exportTemp(n);
            });
        });
    }


    /**
     * Tải lên thành công một Temp
     * @param  {Number} m      Vị trí Temp tải lên kế tiếp
     * @param  {Number} bkLeg  Tổng số lượng Temp tải lên
     * @param  {[type]} tempId Temp Id
     */
    function importSuccess(m, bkLeg, tempId) {
        replaceIcon(".cusTemp2[value='" + tempId + "']", "success");
        noti("(" + $(".hasTemp2 li .icon_success").length + "/" + $(".cusTemp2:checked").length + ") " + trans.im.loading, "load", true);
    }


    /**
     * Tiến trình sau khi kết thúc tải lên một Temp
     * @param  {Number} m      Vị trí Temp tải lên kế tiếp
     * @param  {Number} bkLeg  Tổng số lượng Temp tải lên
     * @param  {Boolean} nopick Tùy chọn xuất bản Temp
     */
    function importEnd(m, bkLeg, nopick) {
        if (m < bkLeg) { // Nếu còn Temp trong danh sách
            if (nopick) { // Trường hợp Temp không được chọn để xuất bản
                importTemp(m); // Tiếp tục ngay với Temp kế tiếp trong danh sách
            } else {

                // Chờ 2 giây mới tiếp tục để tránh lỗi từ chối truy cập
                setTimeout(function () {
                    importTemp(m);
                }, 2000);
            }
        } else { // Khi đã tải lên tất cả Temp
            $("#importPublish, #importZip, #importOne, #importStart").prop("disabled", false);
            noti(trans.im.updateAll, "success", true);
            scrollGoto("zzImport");
            if (allowNotification) {
                new Notification("Success", {
                    body: trans.im.updateAll,
                    icon: setIcons.good
                });
            }

            alertUnloadOff();
        }
    }


    /**
     * Xuất bản một Temp sau khi tải lên
     * @param  {Selector} se       Vị trí biểu tượng
     * @param  {Number} m        Vị trí Temp trong danh sách tải lên
     * @param  {Number} bkLeg    Tổng số lượng Temp tải lên
     * @param  {String} tempId   Temp Id
     * @param  {String} tempName Temp Name
     * @param  {URL} link     Liên kết truy vấn để xuất bản Temp sau khi tải lên
     */
    function importPublish(se, m, bkLeg, tempId, tempName, link) {
        replaceIcon(se, "load");
        $.post(link).done(function () {
            importSuccess(m, bkLeg, tempId);
            importEnd(m, bkLeg);
        }).fail(function () {
            requestLimit(true, 120, se, tempName, "importResume", function () {
                importPublish(se, m, bkLeg, tempId, tempName, link);
            });
        });
    }


    var zipTemp = []; // Danh sách các Temp trong tệp zip tải lên

    /**
     * Tải lên một Temp
     * @param  {Number} n Vị trí Temp trong danh sách tải lên
     */
    function importTemp(n) {

        var temp = zipTemp[n];
        /**
         * Thông số của một Temp
         * [wail] Temp đã sửa nhưng không được xuất bản
         * [l] Temp Mode
         * [t] Temp Id
         * [tpl_name] Temp Name
         * [template] Nội dung Temp
         */

        var bkLeg = zipTemp.length;
        var m = n + 1;
        var tempId = temp.t;
        var tempMode = temp.l;
        var tempName = temp.tpl_name;
        var se = ".cusTemp2[value=\"" + tempId + "\"]";

        if ($(se).is(":checked")) { // Nếu temp được người dùng chọn

            // Bắt đầu tải lên
            replaceIcon(se, "load");
            $.post("/admin/index.forum?part=themes&sub=templates&mode=edit_" + tempMode + "&extended_admin=1&tid=" + tId, {
                t: tempId,
                l: tempMode,
                tpl_name: tempName,
                template: temp.template,
                submit: "Save"
            }).done(function () {
                if (temp.wail && !$("#importPublish").is(":checked")) { // Xuất bản Temp

                    // Chờ 2 giây để tránh lỗi từ chối truy cập
                    setTimeout(function () {
                        importPublish(se, m, bkLeg, tempId, tempName, "/admin/index.forum?part=themes&sub=templates&mode=edit_" + tempMode + "&t=" + tempId + "&l=" + tempMode + "&main_mode=edit&extended_admin=1&pub=1&tid=" + tId);
                    }, 2000);
                } else { // Nếu Temp không cho phép xuất bản thì tiếp tục với Temp kế tiếp
                    importSuccess(m, bkLeg, tempId);
                    importEnd(m, bkLeg);
                }
            }).fail(function () {

                // Xử lý lỗi từ chối truy cập, chờ 120 giây trước khi bắt đầu lại
                requestLimit(true, 120, se, tempName, "importResume", function () {
                    importTemp(n);
                });
            });
        } else { // Nếu không được chọn

            importEnd(m, bkLeg, true); // Kết thúc tiến trình và tiếp tục với Temp kế tiếp
        }
    }

    var arrTest = [];
    /**
     * Lập danh sách template đã được thay đổi
     * @param  {Number} n Vị trí nhóm Temp trong danh sách
     */
    function testTemp(n) {

        var cat = arrTest[n];
        var se = ".catTemp[value='" + cat + "']";
        var $this = $(se);
        var catWrap = $this.parent().parent();
        var m = n + 1;
        var bkLeg = arrTest.length;

        replaceIcon(se, "load");

        $.get("/admin/index.forum?mode=" + cat + "&part=themes&sub=templates&tid=" + tId).done(function (data) {

            // Kiểm tra Temp đã chỉnh sửa mà chưa lưu
            var tempWait = "";
            if ($("#exportWait").is(":checked")) {
                tempWait = ", td.row1 span[style=\"color:red\"]";
            }

            // Tập hợp danh sách các Temp đã sửa (bao gồm Temp chưa lưu nếu được chọn)
            var $customTemp = $(data).find("td.row1 span[style=\"color:#7CBA2C\"]" + tempWait).parent();

            var showResult = "";
            var status = "noTemp";

            if ($customTemp.length) { // Có Temp đã chỉnh sửa
                $customTemp.each(function () {

                    // Đánh dấu x vào tên của Temp chưa lưu
                    var markWail = "";
                    if ($(this).find("span[style=\"color:red\"]").length) {
                        markWail = "x";
                    }

                    var customTempId = this.search.match(/&t=(\d+)&/)[1];
                    showResult += "<li><label><input class=\"cusTemp\" type=\"checkbox\" value=\"" + customTempId + markWail + "\" checked />&nbsp;" + $(this).html() + "</label></li>";
                });
                status = "hasTemp";

            } else { // Không có tem chỉnh sửa
                $this.prop("checked", false);
                showResult = "<li><img src=\"" + setIcons.disable + "\" alt=\"icon\" style=\"height: 13px; width: 13px;\" /> <em>" + trans.ex.notemplate + "</em></li>";
            }

            catWrap.attr("class", status);
            $("#listTemp ." + cat).html(showResult);

            replaceIcon(se, "success");
            noti("(" + m + "/" + bkLeg + ") " + trans.filtering, "load");

            if (m < bkLeg) { // Nếu còn nhóm Temp trong danh sách

                setTimeout(function () {
                    testTemp(m);
                }, 500); // Chờ 0.5 giây và kiểm tra nhóm kế tiếp

            } else { // Khi đã kiểm tra toàn bộ nhóm temp

                // Đếm tổng số Temp và thông báo
                var sumTemp = $(".cusTemp").length;
                var mess = trans.ex.presssubmit;
                if (sumTemp === 0) {
                    mess = trans.ex.pressrefresh;
                    $("#exportTemp").hide();
                }
                $("#refreshTemp, #exportTemp").show();
                noti(trans.ex.sumtemplate + ": <span style=\"color:#FF0080\">" + sumTemp + "</span>.\n" + mess, "info");

                if ($("#exportOne").prop("checked")) {
                    $("#exportTemp").click();
                }
            }
        }).fail(function () {
            requestLimit(false, 60, se, cat, "testResume", function () {
                testTemp(n);
            });
        });
    }

    var listTempGroup = {
        main: "General",
        portal: "Portal",
        gallery: "Gallery",
        calendar: "Calendar",
        group: "Usergroups",
        post: "Post & Private Messages",
        moderation: "Moderation",
        profil: "Profile",
        mobile: "Mobile version"
    }; // Danh sách các nhóm Templates

    var verName = {
        subsilver: "PhpBB2",
        prosilver: "PhpBB3",
        punbb: "PunBB",
        invision: "Invision"
    }; // Tên phiên bản forumotion


    /**
     * Tạo danh sách các nhóm Templates để người dùng chọn
     */
    function menuTemp() {
        var listTemp = $("#listTemp");
        listTemp.empty();
        $.each(listTempGroup, function (key, val) {
            listTemp.append("<div><label><input class=\"catTemp\" type=\"checkbox\" value=\"" + key + "\" />&nbsp;<strong style=\"color: #0014FF\">" + val + "</strong></label><ol class=\"" + key + "\"></ol></div>");
        });
    }

    var vaild = true;

    /**
     * Thực hiện khi phát hiện tên tập tin không hợp lệ
     */
    function notVaildName() {
        vaild = false;
        scrollGoto("zzImport");
        $("#importTemp").hide();

        noti(trans.im.notname, "error", true);
        if (allowNotification) {
            new Notification("Error", {
                body: showTip(trans.im.notname).text,
                icon: setIcons.bad
            });
        }

        alertUnloadOff();
    }


    var init = function () {

        trans = $.extend({}, {
            langcode: "en",
            ex: {
                title: "Export Template",
                tooltip: "In this space, you can also export [[changed template]] to a *.zip file and save it to your computer.\nTo start, click {{Check}} button to get version information and the list of templates that you want to export. Then click {{Ok}}, wait for few seconds and you are good to go.",
                checkall: "Pick all",
                unpublish: "Waiting Templates",
                firsttip: "Pick categories you need then click {{Check}}.",
                download: "Downloading your templates. Click here if its take too long!",
                download2: "Your templates have been downloaded.",
                notemplate: "There's no template archive needed",
                sumtemplate: "The number of template archive needed it's",
                presssubmit: "Click {{Ok}} to start!",
                pressrefresh: "Click {{Start over}} to change your options!",
                loading: "Creating Zip file..."
            },
            im: {
                title: "Import Template",
                tooltip: "In this space, you can also import template from a *.zip file. Attention: your version must match with the version of the template you are going to import.\nTo start, click [[Open file]] (Browse...) pick your template zipped file (*.zip). Then click {{Ok}}, wait for few seconds and you are good to go.",
                choose: "Open zipped file",
                notpublish: "Not publish Template",
                firsttip: "Pick your zipped file then click {{Ok}}.",
                notname: "Opps! File name is <<not valid>>.",
                notversion: "Opps! This template require ",
                source: "Source",
                version: "Version",
                time: "Last update",
                count: "Template(s)",
                updateAll: "All done!",
                loading: "Updating template..."
            },
            decs: "Export/import all of templates in forumotion <<quickly>> and <<accurately>>.",
            option: "Options",
            simpleclick: "One-Click mode",
            wail: "Please hold on a second...",
            notsupport: "Your browser does not support this application!",
            requestlimit: "Access denied! Progress will start over in a while",
            reloadtemplate: "Reload template ",
            errortemplate: "Bad template ",
            second: "s.",
            filtering: "Template filtering...",
            checkone: "Pick at least 1 item",
            progressrun: "Progress is running.",
            bt: {
                filter: "Check",
                refresh: "Start over",
                submit: "Ok",
                start: "START",
            }
        }, fmbackup.translation);

        setIcons = $.extend({}, {
            good: "https://lelinhtinh.github.io/ForumotionBackupTemplates/cdn/icons/good.png",
            bad: "https://lelinhtinh.github.io/ForumotionBackupTemplates/cdn/icons/bad.png",
            load: "https://lelinhtinh.github.io/ForumotionBackupTemplates/cdn/icons/load.gif",
            info: "https://lelinhtinh.github.io/ForumotionBackupTemplates/cdn/icons/info.png",
            error: "https://lelinhtinh.github.io/ForumotionBackupTemplates/cdn/icons/error.gif",
            success: "https://lelinhtinh.github.io/ForumotionBackupTemplates/cdn/icons/success.gif",
            disable: "https://lelinhtinh.github.io/ForumotionBackupTemplates/cdn/icons/disable.png"
        }, fmbackup.icons);

        // Cập nhật thông tin phiên bản Forumotion
        $.get("/admin/index.forum?part=themes&sub=styles&mode=version&extended_admin=1", function (data) {


            var $activetab = $(data).find("#activetab"),
                $user_connected = $(data).find("#page-header .avatar-header + span:first"),
                $form_version = $(data).find("[name=\"form_version\"]");

            if ($form_version.length !== 0 && $activetab.length !== 0 && $user_connected.length !== 0 && !isNaN(fmbackup.page_id)) {

                forumVersion = $form_version.find("dd:first > input:checked").val();
                tId = $activetab.find("a").attr("href").match(/&tid=([^&?]+)/)[1];
                $("#user_connected").html($user_connected.text());
                $(".url").html($(data).find(".url").html());

                $("[name=\"tpl\"][value=\"" + forumVersion + "\"]").prop("checked", true);

                $("#version").find("form").submit(function (e) {
                    e.preventDefault();
                    var $versionInput = $("[name=\"tpl\"], [name=\"change_version\"]"),
                        versionChecked = $("[name=\"tpl\"]:checked").val();
                    $versionInput.prop("disabled", true);

                    $("[name=\"change_version\"]").val("Wail...").addClass("icon_loading");

                    $.post("/admin/index.forum?part=themes&sub=styles&mode=version&extended_admin=1", {
                        tpl: versionChecked,
                        keep_theme: 2,
                        change_version: "Save"
                    }, function () {
                        forumVersion = versionChecked;
                        $versionInput.prop("disabled", false);
                        $("[name=\"change_version\"]").val("Save").removeClass("icon_loading");
                    });
                });

                // Thêm Forumotion Backup Templates vào Bảng quản trị giao diện
                $("#templates").html("<blockquote class=\"block_left\"><p class=\"explain\">" + showTip(trans.decs).html + "</p></blockquote><div id=\"zzBackup\"><fieldset id=\"zzExport\" class=\"style-theme-export\"><legend>" + trans.ex.title + "</legend><p id=\"exportNoti\" class=\"messagebox\"></p><dl class=\"clearfix\"><dt><label for=\"exportAll\"><input id=\"exportAll\" type=\"checkbox\" value=\"\" style=\"display: none;\"><img src=\"https://illiweb.com/fa/admin/icones/question2.png\" title=\"" + showTip(trans.ex.tooltip).text + "\" class=\"show_tooltips\" align=\"absmiddle\"><span>&nbsp;" + trans.ex.checkall + "</span></label><br /><br /><span class=\"backupOption\">" + trans.option + "</span><br /><label for=\"exportWait\"><input id=\"exportWait\" type=\"checkbox\" value=\"\"><span>&nbsp;" + trans.ex.unpublish + "</span></label><label for=\"exportOne\"><input id=\"exportOne\" class=\"oneMode\" type=\"checkbox\" value=\"\"><span>&nbsp;" + trans.simpleclick + "</span></label><button id=\"exportStart\" class=\"buttonOne\">" + trans.bt.start + "</button></dt><dd><div id=\"listTemp\"></div><div class=\"div_btns\"><input type=\"button\" id=\"testTemp\" name=\"testTemp\" value=\"" + trans.bt.filter + "\" class=\"icon_search\" /><input type=\"button\" id=\"refreshTemp\" name=\"refreshTemp\" value=\"" + trans.bt.refresh + "\" class=\"icon_refresh\" style=\"display: none;\" /><input type=\"button\" id=\"exportTemp\" name=\"exportTemp\" value=\"" + trans.bt.submit + "\" class=\"icon_ok\" style=\"display: none;\" /></div></dd></dl></fieldset><fieldset id=\"zzImport\" class=\"style-theme-export\"><legend>" + trans.im.title + "</legend><p id=\"importNoti\" class=\"messagebox\"></p><dl class=\"clearfix\"><dt><label for=\"importZip\"><img src=\"https://illiweb.com/fa/admin/icones/question2.png\" title=\"" + showTip(trans.im.tooltip).text + "\" class=\"show_tooltips\" align=\"absmiddle\">&nbsp;" + trans.im.choose + "</label><br /><br /><span class=\"backupOption\">" + trans.option + "</span><br /><label for=\"importPublish\"><input id=\"importPublish\" type=\"checkbox\" value=\"\" /><span>&nbsp;" + trans.im.notpublish + "</span></label><label for=\"importOne\"><input id=\"importOne\" class=\"oneMode\" type=\"checkbox\" value=\"\"><span>&nbsp;" + trans.simpleclick + "</span></label><button id=\"importStart\" class=\"buttonOne\">" + trans.bt.start + "</button></dt><dd><input type=\"file\" id=\"importZip\" name=\"importZip\" accept=\"application/zip\" /><div id=\"readerTemp\" style=\"margin-top: 20px;\"></div><div class=\"div_btns\"><input type=\"button\" id=\"importTemp\" name=\"importTemp\" value=\"" + trans.bt.submit + "\" class=\"icon_ok\" /></div></dd></dl></fieldset></div>");

                // Tạo danh sách các nhóm Temp trong khu vực Tải xuống
                menuTemp();

                noti(trans.ex.firsttip, "info");


                // EXPORT TEMPLATE

                // Chọn/bỏ chọn Toàn bộ Temp sẽ Tải xuống
                $("#exportAll").change(function () {
                    $(".catTemp").prop("checked", $(this).prop("checked"));
                });

                // Cuộn đến khu vực đang thao tác (Để xem ghi chú tiến trình)
                $(":button", "#zzBackup").click(function () {
                    scrollGoto($(this).closest("fieldset").attr("id"));
                });

                // Lấy danh sách các Temp đã chỉnh sửa
                $("#testTemp").click(function () {
                    $("#exportWait, #exportOne, #exportStart").prop("disabled", true);
                    arrTest = [];
                    if ($(".catTemp:checked").length) { // Nếu đã chọn nhóm Temp cần kiểm tra
                        alertUnload();

                        $(this).hide();
                        $("#refreshTemp, #exportTemp").hide();

                        replaceIcon(".catTemp:not(:checked)", "disable");
                        noti(trans.wail, "load");

                        $(".catTemp:checked").each(function () {
                            arrTest.push($(this).val());
                        });

                        testTemp(0);
                    } else { // Nếu chưa chọn nhóm Temp cần kiểm tra

                        noti(trans.checkone, "error");

                        alertUnloadOff();
                    }
                });

                // Làm mới các thông số
                $("#refreshTemp").click(function () {
                    arrTempExport = [];
                    zip = new JSZip();
                    $(this).add("#exportTemp").hide();
                    $("#testTemp").show();
                    menuTemp();
                    $("#exportAll, #exportWait").prop("checked", false);
                    $("#exportWait, #exportOne, #exportStart").prop("disabled", false);
                    noti(trans.ex.firsttip, "info");

                    alertUnloadOff();
                });

                // Bắt đầu tải xuống
                $("#exportTemp").click(function () {
                    if (!$(".cusTemp:checked").length) { // Nếu không có Temp chọn tải xuống

                        $("#exportWait, #exportOne, #exportStart").prop("disabled", false);
                        noti(trans.checkone, "error");

                        alertUnloadOff();
                    } else {
                        alertUnload();

                        $(".cusTemp:checked").each(function () {
                            var cus = [];
                            var $this = $(this);
                            cus[0] = $this.closest("ol").attr("class"); // Folder
                            cus[1] = $this.val(); // Temp Id
                            cus[2] = $this.next().text(); // Temp name
                            arrTempExport.push(cus);
                        });

                        $(this).hide();
                        $("#refreshTemp").hide();
                        $(".cusTemp").prop("disabled", true);
                        exportTemp(0);

                        noti(trans.wail, "load");
                        replaceIcon(".cusTemp:not(:checked)", "disable");
                    }
                });

                // IMPORT TEMPLATE
                noti(trans.im.firsttip, "info", true);

                // Bắt đầu Tải lên
                $("#importTemp").click(function () {
                    if (!$(".cusTemp2:checked").length) {
                        noti(trans.checkone, "error", true);

                        alertUnloadOff();
                    } else {
                        alertUnload();

                        $(this).hide();
                        noti(trans.wail, "load", true);
                        replaceIcon(".cusTemp2:not(:checked), .catTemp2:not(:checked)", "disable");
                        replaceIcon(".catTemp2:checked", "success");
                        $(".cusTemp2, #importPublish, #importZip, #importOne, #importStart").prop("disabled", true);
                        importTemp(0);
                    }
                });

                var $result = $("#readerTemp");

                // Tải lên tệp zip từ máy tính
                $("#zzImport").on("change", "#importZip", function (evt) {
                    alertUnload();

                    $("#importTemp").show();
                    scrollGoto("zzImport");
                    $result.empty();
                    var files = evt.target.files[0];
                    var reader = new FileReader();

                    reader.onload = (function (theFile) {

                        return function (e) {

                            // Phân tích tên file để lấy ra thông số cần thiết
                            // invision.1432416686.devs.forumvi.com.zip
                            var matchZip = /^(invision|punbb|prosilver|subsilver)\.(\d{10})\.(([\w\d\-]+\.)?([\w\d\-]+\.)\w{2,4})\.zip$/;
                            var nameZip = theFile.name;
                            if (!matchZip.test(nameZip)) { // Nếu tệp không hợp lệ
                                notVaildName();

                            } else {
                                var backup = nameZip.match(matchZip);

                                try {

                                    // Kiểm tra phiên bản Forumotion
                                    if (backup[1] !== forumVersion) {
                                        noti(trans.im.notversion + " <<" + verName[backup[1]] + ">>.", "error", true);
                                        if (allowNotification) {
                                            new Notification("Error", {
                                                body: trans.im.notversion + " " + verName[backup[1]],
                                                icon: setIcons.bad
                                            });
                                        }

                                        alertUnloadOff();
                                    } else {
                                        var zipImport = new JSZip(e.target.result); // Phân tích tệp zip

                                        noti("<<" + trans.im.source + ">>: <a href=\"http://" + backup[3] + "\" target=\"_blank\">" + backup[3] + "</a>\n<<" + trans.im.version + ">>: " + verName[backup[1]] + "\n<<" + trans.im.time + ">>: " + timeFormat(1E3 * parseInt(backup[2], 10)) + "\n<<" + trans.im.count + ">>: " + Object.keys(zipImport.files).length, false, true);

                                        zipTemp = [];
                                        $.each(zipImport.files, function (index, zipEntry) { // Lấy dữ liệu các tệp bên trong

                                            // Phân tích tên file để lấy ra thông số cần thiết
                                            // main/110.index_body.txt
                                            var nameFile = zipEntry.name;
                                            if (!/^(main|portal|gallery|calendar|group|post|moderation|profil|mobile)\/\d{3,4}x?\.\w+\.txt$/.test(nameFile)) { // Nếu tệp không hợp lệ
                                                $result.empty();
                                                notVaildName();

                                                return false;
                                            }

                                            // Tạo nhóm Temp
                                            var arrName = nameFile.split(/\/|\./);
                                            if (!$(".catTemp2[value=\"" + arrName[0] + "\"]").length) {
                                                $result.append("<div class=\"hasTemp2\"><label><input class=\"catTemp2\" type=\"checkbox\" value=\"" + arrName[0] + "\" checked />&nbsp;<strong style=\"color: #0014FF\">" + listTempGroup[arrName[0]] + "</strong></label><ol class=\"" + arrName[0] + "\"></ol></div>");
                                            }

                                            // Đánh dấu Temp không được xuất bản
                                            var wailTemp = arrName[1].split("x");
                                            var colorName = "#7CBA2C";
                                            var wailStatus = true;
                                            if (wailTemp.length === 2) {
                                                colorName = "red";
                                                wailStatus = false;
                                            }

                                            // Thêm Temp vào nhóm tương ứng
                                            $("<li><label><input class=\"cusTemp2\" type=\"checkbox\" value=\"" + wailTemp[0] + "\" checked />&nbsp;<span style=\"color:" + colorName + "\">" + arrName[2] + "</span></label></li>").appendTo(".hasTemp2 ." + arrName[0]);

                                            // Tạo danh sách dữ liệu các Temp
                                            zipTemp.push({
                                                wail: wailStatus,
                                                l: arrName[0],
                                                t: wailTemp[0],
                                                tpl_name: arrName[2],
                                                template: zipEntry.asText()
                                            });
                                        });

                                        if ($("#importOne").prop("checked") && vaild) {
                                            $("#importTemp").click();
                                        }
                                    }
                                } catch (es) { // Lỗi trình duyệt không hỗ trợ
                                    noti(trans.notsupport, "error", true);
                                    // console.log(es.message);
                                }
                            }
                        };
                    })(files);

                    reader.readAsArrayBuffer(files);
                    $("#importZip").replaceWith($("#importZip").clone());
                });

                // Chọn/Bỏ chọn tất cả Temp trong nhóm
                $("#zzBackup").on("change", ".catTemp, .catTemp2", function () {
                    var $this = $(this);
                    $(":checkbox", "." + $this.val()).prop("checked", $this.prop("checked"));
                });

                // ONE-CLICK MODE

                $(".oneMode").on("change", function () {
                    var $parent = $(this).closest("dl"),
                        $start = $parent.find(".buttonOne"),
                        $groupBtn = $parent.find(".div_btns");
                    if ($(this).prop("checked")) {
                        $start.show();
                        $groupBtn.hide();
                    } else {
                        $start.hide();
                        $groupBtn.show();
                    }
                });

                $("#importStart").click(function () {
                    alertUnload();

                    $("#importZip").click();
                });


                $("#exportStart").click(function () {
                    alertUnload();

                    $("#refreshTemp").click();
                    $("#exportAll, #exportWait, .catTemp").prop("checked", true);
                    $("#testTemp").click();
                });
            } else {
                location.replace("/login?redirect=/h" + fmbackup.page_id + "-backup-and-recovery-templates");
            }
        });
    };

    return {
        translation: translation,
        icons: icons,
        page_id: page_id,
        init: init
    };

}();

$(".tabA").click(function (e) {
    e.preventDefault();
    var $this = $(this);
    $(".tabDiv").hide();
    $($this.attr("href")).show();
    $(".tabLi").removeAttr("id");
    $this.parent().attr("id", "activetab");
    $("#backupMode").text($this.text());
});

$("#uploadSkin").load(function () {
    var $skinStatus = $("#importSkinStatus");
    $skinStatus.show();
    setTimeout(function () {
        $skinStatus.slideUp();
    }, 3000);
});
