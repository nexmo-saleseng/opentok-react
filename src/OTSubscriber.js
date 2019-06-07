import React, { Component } from 'react';
import PropTypes from 'prop-types';
import uuid from 'uuid';

export default class OTSubscriber extends Component {
  constructor(props, context) {
    super(props);

    this.state = {
      subscriber: null,
      stream: props.stream || context.stream || null,
      session: props.session || context.session || null,
      currentRetryAttempt: 0,
    };
    this.maxRetryAttempts = props.maxRetryAttempts || 15;
    this.retryAttemptTimeout = props.retryAttemptTimeout || 1000;
  }

  componentDidMount() {
    this.createSubscriber();
  }

  componentDidUpdate(prevProps, prevState) {
    const cast = (value, Type, defaultValue) => (value === undefined ? defaultValue : Type(value));

    const updateSubscriberProperty = (key) => {
      const previous = cast(prevProps.properties[key], Boolean, true);
      const current = cast(this.props.properties[key], Boolean, true);
      if (previous !== current) {
        this.state.subscriber[key](current);
      }
    };

    updateSubscriberProperty('subscribeToAudio');
    updateSubscriberProperty('subscribeToVideo');

    if (prevState.session !== this.state.session || prevState.stream !== this.state.stream) {
      this.destroySubscriber(prevState.session);
      this.createSubscriber();
    }
  }

  componentWillUnmount() {
    this.destroySubscriber();
  }

  getSubscriber() {
    return this.state.subscriber;
  }

  createSubscriber() {
    if (!this.state.session || !this.state.stream) {
      this.setState({ subscriber: null });
      return;
    }

    const container = document.createElement('div');
    container.setAttribute('class', 'OTSubscriberContainer');
    this.node.appendChild(container);

    this.subscriberId = uuid();
    const { subscriberId } = this;
    const subscriber = this.state.session.subscribe(
            this.state.stream,
            container,
            this.props.properties,
            (err) => {
              if (subscriberId !== this.subscriberId) {
                    // Either this subscriber has been recreated or the
                    // component unmounted so don't invoke any callbacks
                return;
              }
              if (err &&
                this.props.retry &&
                this.state.currentRetryAttempt < this.maxRetryAttempts) {
                    // Error during subscribe function
                this.handleRetrySubscriber();
                // If there is a retry action, do we want to execute the onError props function?
                // return;
              }
              if (err && typeof this.props.onError === 'function') {
                this.props.onError(err);
              } else if (!err && typeof this.props.onSubscribe === 'function') {
                this.props.onSubscribe();
              }
            },
        );

    if (
            this.props.eventHandlers &&
            typeof this.props.eventHandlers === 'object'
        ) {
      subscriber.on(this.props.eventHandlers);
    }

    this.setState({ subscriber });
  }

  handleRetrySubscriber() {
    setTimeout(() => {
      let { currentRetryAttempt } = this.state;
      currentRetryAttempt += 1;
      this.setState({ subscriber: null, currentRetryAttempt });
      this.createSubscriber();
    }, this.retryAttemptTimeout);
  }

  destroySubscriber(session = this.props.session) {
    delete this.subscriberId;

    if (this.state.subscriber) {
      if (
                this.props.eventHandlers &&
                typeof this.props.eventHandlers === 'object'
            ) {
        this.state.subscriber.once('destroyed', () => {
          this.state.subscriber.off(this.props.eventHandlers);
        });
      }

      if (session) {
        session.unsubscribe(this.state.subscriber);
      }
    }
  }

  render() {
    return <div ref={(node) => { this.node = node; }} />;
  }
}

OTSubscriber.propTypes = {
  stream: PropTypes.shape({
    streamId: PropTypes.string,
  }),
  session: PropTypes.shape({
    subscribe: PropTypes.func,
    unsubscribe: PropTypes.func,
  }),
  properties: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  retry: PropTypes.bool,
  maxRetryAttempts: PropTypes.number,
  retryAttemptTimeout: PropTypes.number,
  eventHandlers: PropTypes.objectOf(PropTypes.func),
  onSubscribe: PropTypes.func,
  onError: PropTypes.func,
};

OTSubscriber.defaultProps = {
  stream: null,
  session: null,
  properties: {},
  retry: false,
  maxRetryAttempts: 15,
  retryAttemptTimeout: 1000,
  eventHandlers: null,
  onSubscribe: null,
  onError: null,
};

OTSubscriber.contextTypes = {
  stream: PropTypes.shape({
    streamId: PropTypes.string,
  }),
  session: PropTypes.shape({
    subscribe: PropTypes.func,
    unsubscribe: PropTypes.func,
  }),
};
