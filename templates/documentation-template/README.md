# Documentation Template

This template provides a standardized structure for creating high-quality documentation for the Learning Assistant infrastructure project.

## 📋 Template Overview

This template ensures consistency across all documentation and includes:
- Standardized structure and formatting
- Required sections and content guidelines
- Quality checklists and review criteria
- Integration with automated documentation tools

## 🎯 Usage

### For New Documentation
1. Copy the appropriate template from `templates/`
2. Fill in all required sections
3. Follow the style guide
4. Run validation scripts
5. Submit for review

### For Existing Documentation
1. Use the template as a reference for improvements
2. Ensure all required sections are present
3. Update formatting to match standards
4. Validate and submit updates

## 📚 Available Templates

### 1. Module Documentation Template
**File**: `module-template.md`
**Purpose**: Document Terraform modules
**Required Sections**:
- Overview and purpose
- Usage examples
- Variables reference
- Outputs reference
- Requirements and dependencies

### 2. Architecture Documentation Template
**File**: `architecture-template.md`
**Purpose**: Document system architecture
**Required Sections**:
- Architecture overview
- Component descriptions
- Data flow diagrams
- Security considerations
- Performance considerations

### 3. Tutorial Template
**File**: `tutorial-template.md`
**Purpose**: Step-by-step guides
**Required Sections**:
- Learning objectives
- Prerequisites
- Step-by-step instructions
- Verification steps
- Troubleshooting

### 4. Runbook Template
**File**: `runbook-template.md`
**Purpose**: Operational procedures
**Required Sections**:
- Procedure overview
- Prerequisites and access
- Step-by-step procedures
- Rollback procedures
- Escalation contacts

### 5. Troubleshooting Guide Template
**File**: `troubleshooting-template.md`
**Purpose**: Problem resolution guides
**Required Sections**:
- Problem description
- Symptoms and diagnostics
- Resolution steps
- Prevention measures
- Related issues

## 📝 Documentation Standards

### Writing Style
- Use clear, concise language
- Write in active voice when possible
- Use consistent terminology
- Include practical examples
- Provide context and rationale

### Formatting Guidelines
- Use proper Markdown syntax
- Include table of contents for long documents
- Use consistent heading hierarchy
- Format code blocks with syntax highlighting
- Include screenshots and diagrams where helpful

### Required Elements
- Document metadata (title, author, date)
- Clear purpose statement
- Prerequisites and assumptions
- Step-by-step procedures
- Expected outcomes
- Troubleshooting information

### Quality Criteria
- Accuracy and completeness
- Clarity and readability
- Proper formatting
- Working examples
- Up-to-date information

## 🔄 Documentation Workflow

### 1. Planning Phase
- Identify documentation need
- Choose appropriate template
- Define scope and audience
- Plan content structure

### 2. Creation Phase
- Copy template
- Fill in all required sections
- Add examples and diagrams
- Review for completeness

### 3. Review Phase
- Self-review using checklist
- Peer review
- Technical review
- Stakeholder approval

### 4. Publication Phase
- Final formatting check
- Run validation scripts
- Publish to documentation site
- Announce availability

### 5. Maintenance Phase
- Regular content reviews
- Update for changes
- Monitor usage and feedback
- Archive outdated content

## ✅ Quality Checklist

### Content Quality
- [ ] Purpose clearly stated
- [ ] Audience identified
- [ ] Prerequisites listed
- [ ] Steps are clear and actionable
- [ ] Examples are working and tested
- [ ] Troubleshooting information included
- [ ] Related documentation linked

### Technical Quality
- [ ] Code examples syntax-checked
- [ ] Commands tested and verified
- [ ] Screenshots are current
- [ ] Links are valid
- [ ] Markdown syntax correct
- [ ] Formatting consistent

### Completeness
- [ ] All template sections completed
- [ ] Metadata filled in
- [ ] Review comments addressed
- [ ] Version information included
- [ ] Change log updated

## 🎨 Style Guide

### Headings
```markdown
# Main Title (H1) - One per document
## Major Section (H2)
### Subsection (H3)
#### Detail Section (H4)
```

### Code Blocks
```markdown
# Inline code
Use `terraform init` to initialize.

# Code blocks with syntax highlighting
```bash
terraform plan -var-file="production.tfvars"
```

# Configuration examples
```hcl
resource "aws_instance" "example" {
  ami           = "ami-12345"
  instance_type = "t3.micro"
}
```
```

### Lists and Tables
```markdown
# Unordered lists
- Item 1
- Item 2
  - Sub-item A
  - Sub-item B

# Ordered lists
1. First step
2. Second step
3. Third step

# Tables
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
```

### Callouts and Alerts
```markdown
> 💡 **Tip**: Use this for helpful hints

> ⚠️ **Warning**: Use this for important cautions

> 🚨 **Danger**: Use this for critical warnings

> ℹ️ **Info**: Use this for general information
```

### Links and References
```markdown
# Internal links
[Quick Start Guide](./getting-started/quick-start.md)

# External links
[Terraform Documentation](https://terraform.io/docs)

# Reference-style links
[Link text][reference]

[reference]: https://example.com
```

## 🔧 Tools and Automation

### Documentation Generation
- Use `scripts/docs/generate-docs.sh` for automated generation
- Integrate with CI/CD pipeline
- Generate from code comments where possible

### Validation Tools
- Markdown linting with markdownlint
- Link checking with markdown-link-check
- Spell checking with aspell
- Terraform syntax validation

### Review Tools
- GitHub pull request reviews
- Automated quality checks
- Documentation approval workflow

## 📊 Metrics and Analytics

### Documentation Metrics
- Page views and engagement
- Search queries and results
- User feedback and ratings
- Update frequency

### Quality Metrics
- Link health
- Content freshness
- Validation pass rates
- Review completion times

## 🎓 Best Practices

### For Authors
1. **Know Your Audience**: Write for the intended skill level
2. **Test Everything**: Verify all procedures and examples
3. **Keep it Current**: Update documentation with changes
4. **Be Consistent**: Follow established patterns and terminology
5. **Get Feedback**: Actively seek and incorporate user feedback

### for Reviewers
1. **Check Accuracy**: Verify technical content
2. **Test Procedures**: Walk through all steps
3. **Review Clarity**: Ensure content is understandable
4. **Validate Links**: Check all references and links
5. **Consider Audience**: Evaluate appropriateness for target users

### For Maintainers
1. **Regular Reviews**: Schedule periodic content reviews
2. **Monitor Usage**: Track which content is most valuable
3. **Update Promptly**: Keep documentation current with changes
4. **Archive Obsolete**: Remove or archive outdated content
5. **Improve Continuously**: Use feedback to enhance quality

## 🔗 Related Resources

### Documentation Tools
- [Markdown Guide](https://www.markdownguide.org/)
- [Mermaid Diagrams](https://mermaid-js.github.io/)
- [terraform-docs](https://terraform-docs.io/)

### Writing Resources
- [Google Developer Documentation Style Guide](https://developers.google.com/style)
- [Microsoft Writing Style Guide](https://docs.microsoft.com/en-us/style-guide/)
- [Technical Writing Courses](https://developers.google.com/tech-writing)

### Review Process
- [Documentation Review Checklist](./review-checklist.md)
- [Pull Request Template](../.github/pull_request_template.md)
- [Documentation Approval Process](./approval-process.md)

## 📞 Support

### Getting Help
- Documentation team: docs@learningassistant.com
- Style questions: style-guide@learningassistant.com
- Technical review: tech-review@learningassistant.com

### Escalation
- Documentation lead: docs-lead@learningassistant.com
- Engineering manager: eng-manager@learningassistant.com
- Product owner: product@learningassistant.com

---

**Remember**: Good documentation is not just about having information—it's about making that information accessible, actionable, and valuable to your audience.