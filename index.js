
import React, { Component } from 'react';
import { View } from 'react-native';
import PropTypes from 'prop-types';

import SelectionGroup, { SelectionHandler } from '@vendor/react-native-selection-group';

/**
 * SAFETY PATCH (Expo SDK 53 / RN 0.79 / React 19)
 * - Avoids accessing `.style` on undefined by normalizing style props.
 * - Removes deprecated ViewPropTypes imports.
 * - Adds defensive defaultProps.
 */
const safeStyle = (s) => (s === null || s === undefined ? undefined : s);

export class SimpleSurvey extends Component {
  static propTypes = {
    survey: PropTypes.arrayOf(
      PropTypes.shape({
        questionType: PropTypes.string.isRequired,
        questionText: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
        questionId: PropTypes.string,
        options: PropTypes.arrayOf(
          PropTypes.shape({
            optionText: PropTypes.string.isRequired,
            value: PropTypes.any.isRequired,
          })
        ),
        // optional questionSettings for SelectionGroup / MultipleSelectionGroup
        questionSettings: PropTypes.object,
      }).isRequired
    ).isRequired,
    onAnswerSubmitted: PropTypes.func,
    onSurveyFinished: PropTypes.func,
    renderSelector: PropTypes.func,
    renderTextInput: PropTypes.func,
    renderNumericInput: PropTypes.func,
    selectionGroupContainerStyle: PropTypes.any,
    containerStyle: PropTypes.any,
    renderPrevious: PropTypes.func,
    renderNext: PropTypes.func,
    renderFinished: PropTypes.func,
    renderInfo: PropTypes.func,
    autoAdvance: PropTypes.bool,
    renderQuestionText: PropTypes.func,
  };

  static defaultProps = {
    selectionGroupContainerStyle: undefined,
    containerStyle: undefined,
    renderSelector: undefined,
    renderTextInput: undefined,
    renderNumericInput: undefined,
    renderPrevious: undefined,
    renderNext: undefined,
    renderFinished: undefined,
    renderInfo: undefined,
    renderQuestionText: undefined,
    autoAdvance: false,
  };

  constructor(props) {
    super(props);
    this.state = { currentQuestionIndex: 0, answers: [] };
    this.updateAnswer.bind(this);
    this.selectionHandlers = [];
  }

  getAnswers() {
    const filteredAnswers = this.state.answers.filter((n) => n);
    return filteredAnswers;
  }

  // Returns true if all the condition have been met for a multiple selection question.
  validateMultipleSelectionSurveyAnswers() {
    const { currentQuestionIndex, answers } = this.state;
    if (!this.props.survey[currentQuestionIndex].questionType === 'MultipleSelectionGroup') {
      throw new Error(
        'validateMultipleSelectionSurveyAnswers was asked to validate a non MultipleSelectionGroup item'
      );
    }

    let maxMultiSelect = 1;
    let minMultiSelect = 1;
    if (this.props.survey[currentQuestionIndex].questionSettings?.maxMultiSelect) {
      maxMultiSelect = Number(this.props.survey[currentQuestionIndex].questionSettings.maxMultiSelect);
    }

    if (this.props.survey[currentQuestionIndex].questionSettings?.minMultiSelect) {
      minMultiSelect = Number(this.props.survey[currentQuestionIndex].questionSettings.minMultiSelect);
    } else {
      minMultiSelect = maxMultiSelect;
    }

    if (answers[currentQuestionIndex] && answers[currentQuestionIndex].value.length >= minMultiSelect) {
      return true;
    } else {
      return false;
    }
  }

  updateAnswer(answerForCurrentQuestion) {
    const { answers } = this.state;
    answers[this.state.currentQuestionIndex] = answerForCurrentQuestion;
    this.setState({ answers });
  }

  // Do what the next or finished button normally do.
  autoAdvance() {
    const { answers } = this.state;
    const { survey } = this.props;
    let { currentQuestionIndex } = this.state;
    if (
      survey[currentQuestionIndex].questionType === 'MultipleSelectionGroup' &&
      !this.validateMultipleSelectionSurveyAnswers()
    ) {
      return;
    }

    if (currentQuestionIndex === this.props.survey.length - 1) {
      if (this.props.onAnswerSubmitted && answers[currentQuestionIndex]) {
        this.props.onAnswerSubmitted(answers[currentQuestionIndex]);
      }
      if (this.props.onSurveyFinished) {
        // Remove empty answers, coming from info screens.
        const filteredAnswers = answers.filter((n) => n);
        this.props.onSurveyFinished(filteredAnswers);
      }
    } else {
      if (this.props.onAnswerSubmitted && answers[currentQuestionIndex]) {
        this.props.onAnswerSubmitted(answers[currentQuestionIndex]);
      }
      currentQuestionIndex++;
      this.setState({ currentQuestionIndex });
    }
  }

  renderPreviousButton() {
    if (!this.props.renderPrevious) return null;
    let { currentQuestionIndex } = this.state;
    return this.props.renderPrevious(() => {
      currentQuestionIndex--;
      this.setState({ currentQuestionIndex });
    }, currentQuestionIndex !== 0);
  }

  renderFinishOrNextButton() {
    const { answers } = this.state;
    const { survey } = this.props;
    let { currentQuestionIndex } = this.state;

    let enabled = false;

    switch (survey[currentQuestionIndex].questionType) {
      case 'MultipleSelectionGroup':
        enabled = this.validateMultipleSelectionSurveyAnswers();
        break;
      case 'Info':
        enabled = true;
        break;
      default:
        enabled =
          Boolean(answers[currentQuestionIndex]) &&
          (answers[currentQuestionIndex].value || answers[currentQuestionIndex].value === 0);
        break;
    }

    if (currentQuestionIndex === this.props.survey.length - 1) {
      if (!this.props.renderFinished) return null;
      return this.props.renderFinished(() => {
        if (this.props.onAnswerSubmitted && answers[currentQuestionIndex]) {
          this.props.onAnswerSubmitted(answers[currentQuestionIndex]);
        }
        if (this.props.onSurveyFinished) {
          const filteredAnswers = answers.filter((n) => n);
          this.props.onSurveyFinished(filteredAnswers);
        }
      }, enabled);
    }
    if (!this.props.renderNext) return null;
    return this.props.renderNext(() => {
      if (this.props.onAnswerSubmitted && answers[currentQuestionIndex]) {
        this.props.onAnswerSubmitted(answers[currentQuestionIndex]);
      }
      currentQuestionIndex++;
      this.setState({ currentQuestionIndex });
    }, enabled);
  }

  renderNavButtons() {
    const { navButtonContainerStyle } = this.props;
    if (this.props.renderPrevious || this.props.renderNext || this.props.renderFinished) {
      return (
        <View style={safeStyle(navButtonContainerStyle)}>
          {this.renderPreviousButton && this.renderPreviousButton()}
          {this.renderFinishOrNextButton && this.renderFinishOrNextButton()}
        </View>
      );
    }
    return null;
  }

  validateSelectionGroupSettings(questionSettings, currentQuestionIndex) {
    if (!questionSettings) return;
    const { allowDeselect, defaultSelection, autoAdvance: autoAdvanceThisQuestion } = questionSettings;
    if (allowDeselect !== undefined && typeof allowDeselect !== 'boolean') {
      throw new Error(`allowDeselect was not passed in as a boolean for question ${currentQuestionIndex}`);
    }
    if (defaultSelection !== undefined && (this.props.autoAdvance || autoAdvanceThisQuestion)) {
      throw new Error(`Cannot set auto advance and a default selection for question ${currentQuestionIndex}`);
    }
    if (autoAdvanceThisQuestion !== undefined && typeof autoAdvanceThisQuestion !== 'boolean') {
      throw new Error(`autoAdvance was not passed in as a boolean for ${currentQuestionIndex}`);
    }
  }

  renderSelectionGroup() {
    const { survey, renderSelector, selectionGroupContainerStyle, containerStyle } = this.props;
    const { currentQuestionIndex } = this.state;
    const autoAdvanceThisQuestion = Boolean(
      this.props.survey[currentQuestionIndex].questionSettings &&
        this.props.survey[currentQuestionIndex].questionSettings.autoAdvance
    );
    this.validateSelectionGroupSettings(this.props.survey[currentQuestionIndex].questionSettings, currentQuestionIndex);
    if (!this.selectionHandlers[currentQuestionIndex]) {
      if (!this.props.survey[currentQuestionIndex].questionSettings) {
        this.selectionHandlers[currentQuestionIndex] = new SelectionHandler({ maxMultiSelect: 1, allowDeselect: true });
      } else {
        const { allowDeselect, defaultSelection } = this.props.survey[currentQuestionIndex].questionSettings;

        if (defaultSelection !== undefined && typeof defaultSelection !== 'number') {
          throw new Error(`Default Selection not specified as an index for question ${currentQuestionIndex}`);
        }

        const options = {};
        options.maxMultiSelect = 1;
        options.allowDeselect = allowDeselect === undefined || allowDeselect === true;
        options.defaultSelection = defaultSelection !== undefined ? defaultSelection : null;

        this.selectionHandlers[currentQuestionIndex] = new SelectionHandler(options);

        if (typeof options.defaultSelection === 'number') {
          setTimeout(
            () =>
              this.updateAnswer({
                questionId: survey[currentQuestionIndex].questionId,
                value: survey[currentQuestionIndex].options[options.defaultSelection],
              }),
            0
          );
        }
      }
    }

    return (
      <View style={safeStyle(containerStyle)}>
        {this.props.renderQuestionText
          ? this.props.renderQuestionText(this.props.survey[currentQuestionIndex].questionText)
          : null}
        <SelectionGroup
          onPress={this.selectionHandlers[currentQuestionIndex].selectionHandler}
          items={survey[currentQuestionIndex].options}
          isSelected={this.selectionHandlers[currentQuestionIndex].isSelected}
          renderContent={renderSelector}
          containerStyle={safeStyle(selectionGroupContainerStyle)}
          onItemSelected={(item) => {
            this.updateAnswer({
              questionId: survey[currentQuestionIndex].questionId,
              value: item,
            });
            (this.props.autoAdvance || autoAdvanceThisQuestion) && this.autoAdvance();
          }}
          onItemDeselected={() => {
            this.updateAnswer({
              questionId: survey[currentQuestionIndex].questionId,
              value: null,
            });
          }}
        />
        {this.renderNavButtons()}
      </View>
    );
  }

  renderMultipleSelectionGroup() {
    const { survey, renderSelector, selectionGroupContainerStyle, containerStyle } = this.props;
    const { currentQuestionIndex } = this.state;
    const { allowDeselect, defaultSelection, autoAdvance: autoAdvanceThisQuestion } =
      this.props.survey[currentQuestionIndex].questionSettings;
    const multiSelectMax = Number(this.props.survey[currentQuestionIndex].questionSettings.maxMultiSelect);
    if (multiSelectMax === 1) {
      return this.renderSelectionGroup();
    }
    this.validateSelectionGroupSettings(this.props.survey[currentQuestionIndex].questionSettings);

    if (!this.selectionHandlers[currentQuestionIndex]) {
      if (this.props.survey[currentQuestionIndex].questionSettings.maxMultiSelect) {
        if (defaultSelection !== undefined && !Array.isArray(defaultSelection)) {
          throw new Error(
            `Default Selection not specified as an array for multiple selection question ${currentQuestionIndex}`
          );
        }
        const options = {};
        options.maxMultiSelect = multiSelectMax;
        options.allowDeselect = allowDeselect === undefined || allowDeselect === true;
        options.defaultSelection = defaultSelection !== undefined ? defaultSelection : null;
        this.selectionHandlers[currentQuestionIndex] = new SelectionHandler(options);

        if (Array.isArray(options.defaultSelection)) {
          setTimeout(
            () =>
              this.updateAnswer({
                questionId: survey[currentQuestionIndex].questionId,
                value: survey[currentQuestionIndex].options.filter((element, index) =>
                  options.defaultSelection.includes(index)
                ),
              }),
            0
          );
        }
      }
    }

    return (
      <View style={safeStyle(containerStyle)}>
        {this.props.renderQuestionText
          ? this.props.renderQuestionText(this.props.survey[currentQuestionIndex].questionText)
          : null}
        <SelectionGroup
          onPress={this.selectionHandlers[currentQuestionIndex].selectionHandler}
          items={survey[currentQuestionIndex].options}
          isSelected={this.selectionHandlers[currentQuestionIndex].isSelected}
          getAllSelectedItemIndexes={this.selectionHandlers[currentQuestionIndex].getAllSelectedItemIndexes}
          renderContent={renderSelector}
          containerStyle={safeStyle(selectionGroupContainerStyle)}
          onItemSelected={(item, allSelectedItems) => {
            this.updateAnswer({
              questionId: survey[currentQuestionIndex].questionId,
              value: allSelectedItems,
            });
            (autoAdvanceThisQuestion || this.props.autoAdvance) && this.autoAdvance();
          }}
          onItemDeselected={(item, allSelectedItems) => {
            this.updateAnswer({
              questionId: survey[currentQuestionIndex].questionId,
              value: allSelectedItems,
            });
          }}
        />
        {this.renderNavButtons()}
      </View>
    );
  }

  renderNumeric() {
    const { survey, renderNumericInput, containerStyle } = this.props;
    const currentQuestionIndex = this.state.currentQuestionIndex;
    const answers = this.state.answers;
    const { questionText, questionId, placeholderText = null, defaultValue = '' } =
      survey[currentQuestionIndex];

    if (
      answers[currentQuestionIndex] === undefined &&
      (defaultValue || defaultValue === 0) &&
      Number.isInteger(parseInt(`${defaultValue}`, 10))
    ) {
      setTimeout(
        () =>
          this.updateAnswer({
            questionId: survey[currentQuestionIndex].questionId,
            value: defaultValue,
          }),
        0
      );
    }

    return (
      <View style={safeStyle(containerStyle)}>
        {this.props.renderQuestionText ? this.props.renderQuestionText(questionText) : null}
        {renderNumericInput(
          (value) => {
            const valInt = parseInt(value, 10);
            if (Number.isInteger(valInt)) {
              this.updateAnswer({
                questionId,
                value: valInt,
              });
            } else if (value === '') {
              this.updateAnswer({
                questionId,
                value: '',
              });
            }
          },
          answers[currentQuestionIndex] === undefined ? '' : answers[currentQuestionIndex].value,
          placeholderText,
          this.props.autoAdvance ? this.autoAdvance.bind(this) : null
        )}
        {this.renderNavButtons()}
      </View>
    );
  }

  renderTextInputElement() {
    const { survey, renderTextInput, containerStyle } = this.props;
    const currentQuestionIndex = this.state.currentQuestionIndex;
    const answers = this.state.answers;
    const { questionText, questionId, placeholderText = null, defaultValue } = survey[currentQuestionIndex];
    if (answers[currentQuestionIndex] === undefined && defaultValue) {
      setTimeout(
        () =>
          this.updateAnswer({
            questionId: survey[currentQuestionIndex].questionId,
            value: defaultValue,
          }),
        0
      );
    }

    return (
      <View style={safeStyle(containerStyle)}>
        {this.props.renderQuestionText ? this.props.renderQuestionText(questionText) : null}
        {renderTextInput(
          (value) =>
            this.updateAnswer({
              questionId,
              value,
            }),
          answers[currentQuestionIndex] === undefined ? undefined : answers[currentQuestionIndex].value,
          placeholderText,
          this.props.autoAdvance ? this.autoAdvance.bind(this) : null
        )}
        {this.renderNavButtons()}
      </View>
    );
  }

  renderInfo() {
    const currentQuestionIndex = this.state.currentQuestionIndex;
    const { survey, renderInfo, containerStyle } = this.props;
    const { questionText } = survey[currentQuestionIndex];

    return (
      <View style={safeStyle(containerStyle)}>
        {renderInfo(questionText)}
        {this.renderNavButtons()}
      </View>
    );
  }

  render() {
    const { survey } = this.props;
    const currentQuestion = this.state.currentQuestionIndex;
    switch (survey[currentQuestion].questionType) {
      case 'SelectionGroup':
        return this.renderSelectionGroup();
      case 'MultipleSelectionGroup':
        return this.renderMultipleSelectionGroup();
      case 'TextInput':
        return this.renderTextInputElement();
      case 'NumericInput':
        return this.renderNumeric();
      case 'Info':
        return this.renderInfo();
      default:
        return <View />;
    }
  }
}

export default SimpleSurvey;
