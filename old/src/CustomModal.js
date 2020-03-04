import React from 'react';

class CustomModal extends React.Component {
    componentDidMount() {
        var modalOverlays = document.getElementsByClassName('modal-overlay');
        for (var i = 0; i < modalOverlays.length; i++) {
            modalOverlays[i].addEventListener('click', function () {
                var modals = document.getElementsByClassName('modal-wrapper');
                for (var j = 0; j < modals.length; j++) {
                    modals[j].style.display = 'none';
                }
            });
        }

        var modalCloses = document.getElementsByClassName('modal-close');
        for (var k = 0; k < modalCloses.length; k++) {
            modalCloses[k].addEventListener('click', function () {
                var modals = document.getElementsByClassName('modal-wrapper');
                for (var l = 0; l < modals.length; l++) {
                    modals[l].style.display = 'none';
                }
            });
        }
    }

    render() {
        return (
            <div id="about-modal" className="modal-wrapper">
                <div className="modal-overlay"></div>
                <div className="modal-content">
                    <span className="modal-close">✕</span>
                    {this.props.children}
                </div>
            </div>
        );
    }
}

export default CustomModal;
