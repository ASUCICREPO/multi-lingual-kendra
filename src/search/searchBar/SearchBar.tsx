import Kendra from "aws-sdk/clients/kendra";
import React from "react";
import {
  Form,
  Button,
  InputGroup,
  Image
} from "react-bootstrap";
import Autocomplete from "react-autocomplete";
import debounce from 'lodash.debounce'; 
import AWS from 'aws-sdk';
import searchImage from "../images/search-image.svg";
import "../search.scss";
import { comprehend, translate } from "../../services/Kendra";

const SUGGESTIONS_KEYSTROKE_DELAY = 200; // adjust as needed
const MIN_TEXT_LENGTH_FOR_SUGGESTIONS = 2;
const MAX_TEXT_LENGTH_FOR_SUGGESTIONS = 60;

interface SearchBarProps {
  onSubmit: (queryText: string, pageNumber: number) => void;
  suggestionsEnabled: boolean;
  getQuerySuggestions: (queryText: string) => Promise<Kendra.Types.SuggestionList | undefined>;
}

interface SearchBarState {
  queryText: string;
  suggestions: Kendra.Types.SuggestionList;
  language: string;
}

export default class SearchBar extends React.Component<
  SearchBarProps,
  SearchBarState
> {
  constructor(props: SearchBarProps) {
    super(props);

    this.state = {
      queryText: "",
      suggestions: [],
      language: ""
    };

    this.populateSuggestions = debounce(this.populateSuggestions, SUGGESTIONS_KEYSTROKE_DELAY);
  }

  onChange = (
    e: React.ChangeEvent<HTMLInputElement>, value: string
  ) => {
    this.setState({ queryText: value })
    const { suggestionsEnabled } = this.props;
    if (suggestionsEnabled && value.length >= MIN_TEXT_LENGTH_FOR_SUGGESTIONS && value.length <= MAX_TEXT_LENGTH_FOR_SUGGESTIONS) {
        this.populateSuggestions(value);
    } else {
        this.setState({ suggestions: [] })
    }
  }

  populateSuggestions = (
    value: string
  ) => {
    const { getQuerySuggestions } = this.props;
    var that = this;

    // var newval = await detectAndTranslate(value)
    // console.log(newval)
    getQuerySuggestions(value).then(function(result) {
        if (result) {
            that.setState({ suggestions: result  })
        }
    });
  }

  onSearch = async (
    event:
      | React.FormEvent<HTMLFormElement>
      | React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // callback to the API call
    const { onSubmit } = this.props;

    onSubmit(this.state.queryText, 1);

    // // Detect and translate on search
    // try {
    //   var detectedlang = await detectLanguage(this.state.queryText)
    //   var translatedText = await textTranslate(detectedlang, this.state.queryText)
    //   console.log(translatedText)
    //   onSubmit(translatedText, detectedlang, 1);

    // } catch (error) {
    //   console.error('Error detecting or translating language:', error);
    // }

  };

  

  onSelect = async (
    value: string
  ) => {
    const { onSubmit } = this.props;

    this.setState({ queryText: value });
    // console.log(value)
    onSubmit(value, 1);
  };

  buildSuggestionItems() {
    const { suggestions } = this.state;
    if (suggestions.length === 0) {
      return [];
    }
    return suggestions.map(suggestion => this.buildSuggestionItemWithHighlightedLabel(suggestion));
  }

  buildSuggestionItemWithHighlightedLabel = (
    suggestion: Kendra.Types.Suggestion
  ) => {
    if (suggestion && suggestion.Value && suggestion.Value.Text) {
        let suggestionText = suggestion.Value.Text.Text;
        const suggestionHighlights = suggestion.Value.Text.Highlights;
        if (suggestionText && suggestionHighlights) {
            const suggestionHighlight = suggestionHighlights[0];
            if (suggestionHighlight && suggestionHighlight.BeginOffset) {
                // split text at BeginOffset and bold second part
                let label = (<span>
                                {suggestionText.substring(0, suggestionHighlight.BeginOffset)}
                                <strong>{suggestionText.substring(suggestionHighlight.BeginOffset)}</strong>
                             </span>);
                return ({label: label, key: suggestionText});
            }
        }
        // set suggestionText as label if no highlights
        return ({label: suggestionText, key: suggestionText});
    }
  }

  showSearchForm = () => {
    const { queryText, language } = this.state;
    const suggestionItems = this.buildSuggestionItems();
    return (
      <Form
        noValidate
        onSubmit={(event: React.FormEvent<HTMLFormElement>) =>
          this.onSearch(event)
        }
      >
        <InputGroup className="search-bar">
           <div style={{ width: "100%", display: "flex" }}>
              <Autocomplete
                getItemValue={(item) => item.key}
                items={suggestionItems}
                renderItem={(item, isHighlighted) =>
                  <div style={{ background: isHighlighted ? '#ddfaff' : 'white' }} key={item.key}>
                    {item.label}
                  </div>
                }
                value={queryText}
                onChange={this.onChange}
                onSelect={this.onSelect}
                autoHighlight={false}
                inputProps={{ style: { width: "100%", height: "100%", padding: "6px 12px" }, placeholder: "Enter a query here" }}
                wrapperStyle={{ width: "100%" }}
                menuStyle={{
                  borderRadius: '3px',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
                  background: 'rgba(255, 255, 255, 0.9)',
                  padding: '2px 12px',
                  fontSize: '90%',
                  position: 'fixed',
                  overflow: 'auto',
                  maxHeight: '50%',
                  zIndex: 10
                }}
              />
              <Button
                variant="outline-secondary"
                className="search-button"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
                  this.onSearch(event)
                }
              >
                <Image src={searchImage} rounded />
              </Button>
           </div>
        </InputGroup>
      </Form>
    );
  };

  render() {
    return <div>{this.showSearchForm()}</div>;
  }
}

function detectLanguage(text: string): Promise<string> {
  return new Promise((resolve) => {
    var detectedlanguage: string
    if(comprehend) {
      comprehend.detectDominantLanguage({ Text: text },  (err, data) => {
        if (err) {
          console.log(err, err.stack); 
          resolve("en")
        }// an error occurred
        else {
          detectedlanguage = data.Languages?.[0]?.LanguageCode || ''
          // console.log(detectedlanguage);   
          resolve(detectedlanguage)
        }      
      });
    }
    else {
      resolve("en")
    }
  });
}

function textTranslate(detectedlanguage: string, text: string): Promise<string> {
  return new Promise((resolve) => {
    var translatedText = text
    var params = {
      SourceLanguageCode: detectedlanguage,
      TargetLanguageCode: 'en', 
      Text: text, 
    };

    if(translate) {
      translate.translateText(params, function(err, data) {
        if (err){
          console.log(err, err.stack);
          resolve(text)
        } 
        else {    
          translatedText = data.TranslatedText || '' 
          resolve(translatedText)
        }
      });
    }
    else {
      resolve(text)
    }
  });
}