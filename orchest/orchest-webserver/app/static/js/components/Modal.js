import React from 'react';

class Modal extends React.Component {

    render() {
        return <div className="modal">
            <div className="fullscreen-overlay"></div>

            <div className="modal-body">
                <div className="modal-content">
                    {this.props.body}
                </div>
            </div>
        </div>;
    }

}

export default Modal